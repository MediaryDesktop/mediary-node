package service

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/mangadex"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/opds"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const SourcePrefixOPDS = "opds:"

// Passwords holds the servers' passwords outside the database.
type Passwords interface {
	Password(serverID int64) (string, error)
	SetPassword(serverID int64, password string) error
}

type Options struct {
	Client *opds.Client
	// MangaDex is nil when the node is configured without it.
	MangaDex *mangadex.Client
	Now      func() time.Time
}

type Service struct {
	store     *store.Store
	passwords Passwords
	logger    zerolog.Logger
	opts      Options
	dex       *dexCache
}

func New(st *store.Store, passwords Passwords, logger zerolog.Logger, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{store: st, passwords: passwords, logger: logger, opts: opts, dex: newDexCache()}
}

// Server is an OPDS server as the API shows it: never with its password.
type Server struct {
	ID          int64
	Name        string
	URL         string
	Username    string
	HasPassword bool
}

type ServerInput struct {
	Name     string
	URL      string
	Username string
	// Password nil leaves the stored one as it is; "" removes it.
	Password *string
}

func (s *Service) Servers(ctx context.Context) ([]Server, error) {
	rows, err := s.store.Servers(ctx)
	if err != nil {
		return nil, err
	}

	servers := make([]Server, 0, len(rows))
	for _, row := range rows {
		server, err := s.withPassword(row)
		if err != nil {
			return nil, err
		}
		servers = append(servers, server)
	}

	return servers, nil
}

func (s *Service) CreateServer(ctx context.Context, in ServerInput) (*Server, error) {
	clean, err := validServer(in)
	if err != nil {
		return nil, err
	}

	row, err := s.store.CreateServer(ctx, clean, s.opts.Now())
	if err != nil {
		return nil, err
	}

	if in.Password != nil {
		if setErr := s.passwords.SetPassword(row.ID, *in.Password); setErr != nil {
			return nil, apperr.Wrap(setErr, apperr.KindInternal, "could not store the password")
		}
	}

	server, err := s.withPassword(*row)

	return &server, err
}

func (s *Service) UpdateServer(ctx context.Context, id int64, in ServerInput) (*Server, error) {
	clean, err := validServer(in)
	if err != nil {
		return nil, err
	}
	clean.ID = id

	row, err := s.store.UpdateServer(ctx, clean, s.opts.Now())
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", id)
	}

	if in.Password != nil {
		if setErr := s.passwords.SetPassword(id, *in.Password); setErr != nil {
			return nil, apperr.Wrap(setErr, apperr.KindInternal, "could not store the password")
		}
	}

	server, err := s.withPassword(*row)

	return &server, err
}

func (s *Service) DeleteServer(ctx context.Context, id int64) error {
	deleted, err := s.store.DeleteServer(ctx, id, sourceID(id))
	if err != nil {
		return err
	}
	if !deleted {
		return apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", id)
	}

	if err := s.passwords.SetPassword(id, ""); err != nil {
		s.logger.Warn().Err(err).Int64("server", id).Msg("could not forget the password of a deleted OPDS server")
	}

	return nil
}

// CheckInput is a server to try before or after saving it. A saved server's
// password is used when the input does not carry one.
type CheckInput struct {
	ServerID *int64
	URL      string
	Username string
	Password *string
}

// CheckResult tells the user what is wrong, in terms they can act on.
type CheckResult struct {
	OK      bool
	Problem string // unauthorized | not_opds | unreachable | other_host
	Detail  string
}

func (s *Service) CheckServer(ctx context.Context, in CheckInput) (*CheckResult, error) {
	address, err := validURL(in.URL)
	if err != nil {
		return nil, err
	}

	server := opds.Server{URL: address, Username: strings.TrimSpace(in.Username)}

	switch {
	case in.Password != nil:
		server.Password = *in.Password
	case in.ServerID != nil:
		if server.Password, err = s.passwords.Password(*in.ServerID); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
		}
	}

	if err := s.opts.Client.Check(ctx, server); err != nil {
		return &CheckResult{Problem: problem(err), Detail: err.Error()}, nil
	}

	return &CheckResult{OK: true}, nil
}

func (s *Service) withPassword(row store.Server) (Server, error) {
	password, err := s.passwords.Password(row.ID)
	if err != nil {
		return Server{}, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
	}

	return Server{ID: row.ID, Name: row.Name, URL: row.URL, Username: row.Username, HasPassword: password != ""}, nil
}

// connection is a saved server ready for the client.
func (s *Service) connection(ctx context.Context, id int64) (row *store.Server, server opds.Server, err error) {
	row, err = s.store.Server(ctx, id)
	if err != nil {
		return nil, opds.Server{}, err
	}
	if row == nil {
		return nil, opds.Server{}, apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", id)
	}

	password, err := s.passwords.Password(id)
	if err != nil {
		return nil, opds.Server{}, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
	}

	return row, opds.Server{URL: row.URL, Username: row.Username, Password: password}, nil
}

func validServer(in ServerInput) (store.Server, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return store.Server{}, apperr.Invalid("name", "a server needs a name")
	}
	if utf8.RuneCountInString(name) > 100 {
		return store.Server{}, apperr.Invalid("name", "a server name is at most 100 characters")
	}

	address, err := validURL(in.URL)
	if err != nil {
		return store.Server{}, err
	}

	return store.Server{Name: name, URL: address, Username: strings.TrimSpace(in.Username)}, nil
}

func validURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)

	address, err := url.Parse(raw)
	if err != nil || (address.Scheme != "http" && address.Scheme != "https") || address.Host == "" {
		return "", apperr.Invalid("url", "the address must start with http:// or https://")
	}
	if address.User != nil {
		return "", apperr.Invalid("url", "put the user name and password in their own fields, not in the address")
	}

	address.Fragment = ""

	return address.String(), nil
}

func problem(err error) string {
	switch {
	case errors.Is(err, opds.ErrUnauthorized):
		return "unauthorized"
	case errors.Is(err, opds.ErrOtherHost):
		return "other_host"
	case errors.Is(err, opds.ErrNotOPDS), errors.Is(err, opds.ErrNoSearch):
		return "not_opds"
	default:
		return "unreachable"
	}
}

// upstream turns a client error into one the API reports. The server is the
// user's, so the message says which part of it failed.
func upstream(err error, serverName string) error {
	if errors.Is(err, context.Canceled) {
		return err
	}

	return apperr.Wrap(err, apperr.KindUpstream, "%s: %s", serverName, err.Error())
}

func sourceID(serverID int64) string {
	return SourcePrefixOPDS + strconv.FormatInt(serverID, 10)
}

// serverOf reads "opds:3" back into 3.
func serverOf(source string) (int64, bool) {
	raw, ok := strings.CutPrefix(source, SourcePrefixOPDS)
	if !ok {
		return 0, false
	}

	id, err := strconv.ParseInt(raw, 10, 64)

	return id, err == nil && id > 0
}
