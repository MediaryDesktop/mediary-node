// Package servers is the user's OPDS catalogues as sources of books: their own
// Calibre-Web or Kavita, or Standard Ebooks with a Patrons Circle login. Each
// saved server is a source of its own, searched through the catalogue's search.
package servers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/opds"
)

const maxNameRunes = 100

// Passwords holds the servers' passwords outside the database.
type Passwords interface {
	Get(key string) (string, error)
	Set(key, value string) error
}

type Options struct {
	DB        *sql.DB
	Client    *opds.Client
	Passwords Passwords
	Logger    zerolog.Logger
	Now       func() time.Time
}

type Servers struct {
	db        *sql.DB
	client    *opds.Client
	passwords Passwords
	logger    zerolog.Logger
	now       func() time.Time
}

func New(opts Options) *Servers {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Servers{db: opts.DB, client: opts.Client, passwords: opts.Passwords, logger: opts.Logger, now: opts.Now}
}

// Server is a server as the API shows it: never with its password.
type Server struct {
	ID          int64
	Name        string
	URL         string
	Username    string
	HasPassword bool
}

type Input struct {
	Name     string
	URL      string
	Username string
	// Password nil leaves the stored one as it is; "" removes it. Standard Ebooks
	// takes the patron's e-mail as the user name and no password.
	Password *string
}

func (s *Servers) List(ctx context.Context) ([]Server, error) {
	rows, err := sqlc.New(s.db).ListBookOPDSServers(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the book servers: %w", err)
	}

	out := make([]Server, 0, len(rows))
	for i := range rows {
		server, err := s.public(&rows[i])
		if err != nil {
			return nil, err
		}
		out = append(out, server)
	}

	return out, nil
}

func (s *Servers) Create(ctx context.Context, in Input) (*Server, error) {
	name, address, username, err := valid(in)
	if err != nil {
		return nil, err
	}

	stamp := s.now().UTC().Format(time.RFC3339)
	row, err := sqlc.New(s.db).CreateBookOPDSServer(ctx, sqlc.CreateBookOPDSServerParams{
		Name: name, Url: address, Username: username, CreatedAt: stamp, UpdatedAt: stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("save the book server: %w", err)
	}

	if in.Password != nil {
		if err = s.passwords.Set(key(row.ID), *in.Password); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "could not store the password")
		}
	}

	server, err := s.public(&row)

	return &server, err
}

func (s *Servers) Update(ctx context.Context, id int64, in Input) (*Server, error) {
	name, address, username, err := valid(in)
	if err != nil {
		return nil, err
	}

	row, err := sqlc.New(s.db).UpdateBookOPDSServer(ctx, sqlc.UpdateBookOPDSServerParams{
		Name: name, Url: address, Username: username, UpdatedAt: s.now().UTC().Format(time.RFC3339), ID: id,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, apperr.New(apperr.KindNotFound, "book server %d does not exist", id)
	}
	if err != nil {
		return nil, fmt.Errorf("save the book server: %w", err)
	}

	if in.Password != nil {
		if err = s.passwords.Set(key(id), *in.Password); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "could not store the password")
		}
	}

	server, err := s.public(&row)

	return &server, err
}

// Delete forgets the server and its password. Books already saved from it stay
// in the library; one still queued fails, its source gone.
func (s *Servers) Delete(ctx context.Context, id int64) error {
	deleted, err := sqlc.New(s.db).DeleteBookOPDSServer(ctx, id)
	if err != nil {
		return fmt.Errorf("delete the book server: %w", err)
	}
	if deleted == 0 {
		return apperr.New(apperr.KindNotFound, "book server %d does not exist", id)
	}

	if err = s.passwords.Set(key(id), ""); err != nil {
		s.logger.Warn().Err(err).Int64("server", id).Msg("could not forget the password of a deleted book server")
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

// CheckResult says what is wrong in terms the user can act on.
type CheckResult struct {
	OK bool
	// Problem is unauthorized, not_opds, no_search, unreachable or other_host.
	Problem string
	Detail  string
}

// Check reads the catalogue and its search, the two things a book server needs.
func (s *Servers) Check(ctx context.Context, in CheckInput) (*CheckResult, error) {
	address, err := validURL(in.URL)
	if err != nil {
		return nil, err
	}

	server := opds.Server{URL: address, Username: strings.TrimSpace(in.Username)}

	switch {
	case in.Password != nil:
		server.Password = *in.Password
	case in.ServerID != nil:
		if server.Password, err = s.passwords.Get(key(*in.ServerID)); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
		}
	}

	// A search for nothing in particular proves the search works without
	// depending on what the catalogue holds.
	if _, err = s.client.SearchPublications(ctx, server, "a"); err != nil {
		return &CheckResult{Problem: problem(err), Detail: err.Error()}, nil
	}

	return &CheckResult{OK: true}, nil
}

// connection is a saved server ready for the client.
func (s *Servers) connection(ctx context.Context, id int64) (*sqlc.BookOpdsServer, opds.Server, error) {
	row, err := sqlc.New(s.db).GetBookOPDSServer(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, opds.Server{}, apperr.New(apperr.KindPrecondition, "the book server %d is no longer set up", id)
	}
	if err != nil {
		return nil, opds.Server{}, fmt.Errorf("read the book server: %w", err)
	}

	password, err := s.passwords.Get(key(id))
	if err != nil {
		return nil, opds.Server{}, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
	}

	return &row, opds.Server{URL: row.Url, Username: row.Username, Password: password}, nil
}

func (s *Servers) public(row *sqlc.BookOpdsServer) (Server, error) {
	password, err := s.passwords.Get(key(row.ID))
	if err != nil {
		return Server{}, apperr.Wrap(err, apperr.KindInternal, "could not read the stored password")
	}

	return Server{ID: row.ID, Name: row.Name, URL: row.Url, Username: row.Username, HasPassword: password != ""}, nil
}

func valid(in Input) (name, address, username string, err error) {
	name = strings.TrimSpace(in.Name)
	if name == "" {
		return "", "", "", apperr.Invalid("name", "a server needs a name")
	}
	if utf8.RuneCountInString(name) > maxNameRunes {
		return "", "", "", apperr.Invalid("name", "a server name is at most %d characters", maxNameRunes)
	}

	if address, err = validURL(in.URL); err != nil {
		return "", "", "", err
	}

	return name, address, strings.TrimSpace(in.Username), nil
}

func validURL(raw string) (string, error) {
	address, err := url.Parse(strings.TrimSpace(raw))
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
	case errors.Is(err, opds.ErrNoSearch):
		return "no_search"
	case errors.Is(err, opds.ErrNotOPDS):
		return "not_opds"
	default:
		return "unreachable"
	}
}

func key(id int64) string {
	return strconv.FormatInt(id, 10)
}
