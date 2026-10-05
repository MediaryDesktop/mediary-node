package service

import (
	"context"
	"io"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The service is the download queue's source: it knows how to reach a chapter by
// its reference. Only chapters on the user's OPDS servers for now.

func (s *Service) Describe(ctx context.Context, ref string) (*download.Chapter, error) {
	serverID, key, err := opdsRef(ref)
	if err != nil {
		return nil, err
	}

	decoded, err := decodeKey(key)
	if err != nil {
		return nil, err
	}

	row, err := s.store.Server(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", serverID)
	}

	chapter := &download.Chapter{
		Series:     decoded.Title,
		Title:      decoded.Title,
		Number:     decoded.Number,
		SourceName: row.Name,
		Pages:      decoded.Pages,
		Archive:    decoded.Archive != "",
	}

	link, err := s.store.LinkBySeries(ctx, sourceID(serverID), decoded.Series)
	if err != nil {
		return nil, err
	}
	if link != nil {
		chapter.MediaRef = link.MediaRef
		if link.SeriesTitle != "" {
			chapter.Series = link.SeriesTitle
		}
	}

	return chapter, nil
}

func (s *Service) DownloadPage(ctx context.Context, ref string, index int) (data []byte, contentType string, err error) {
	serverID, key, err := opdsRef(ref)
	if err != nil {
		return nil, "", err
	}

	return s.Page(ctx, serverID, key, index)
}

func (s *Service) Archive(ctx context.Context, ref string) (io.ReadCloser, error) {
	serverID, key, err := opdsRef(ref)
	if err != nil {
		return nil, err
	}

	decoded, err := decodeKey(key)
	if err != nil {
		return nil, err
	}
	if decoded.Archive == "" {
		return nil, apperr.New(apperr.KindPrecondition, "the server offers this chapter page by page only")
	}

	row, server, err := s.connection(ctx, serverID)
	if err != nil {
		return nil, err
	}

	body, err := s.opts.Client.Archive(ctx, server, decoded.Archive)
	if err != nil {
		return nil, upstream(err, row.Name)
	}

	return body, nil
}

// opdsRef reads opds:<server>:<key>; every other source is refused here.
func opdsRef(ref string) (serverID int64, key string, err error) {
	rest, ok := strings.CutPrefix(ref, SourcePrefixOPDS)
	if !ok {
		return 0, "", apperr.Invalid("ref", "only chapters on an OPDS server can be downloaded, not %q", ref)
	}

	raw, key, ok := strings.Cut(rest, ":")
	serverID, parseErr := strconv.ParseInt(raw, 10, 64)
	if !ok || parseErr != nil || serverID <= 0 || key == "" {
		return 0, "", apperr.Invalid("ref", "%q is not an OPDS chapter", ref)
	}

	return serverID, key, nil
}

// downloadSource adapts the service to the queue's Source, whose page method has
// the name Page that the reader's port already uses here with other arguments.
type downloadSource struct {
	svc *Service
}

func (d downloadSource) Describe(ctx context.Context, ref string) (*download.Chapter, error) {
	return d.svc.Describe(ctx, ref)
}

func (d downloadSource) Page(ctx context.Context, ref string, index int) (data []byte, contentType string, err error) {
	return d.svc.DownloadPage(ctx, ref, index)
}

func (d downloadSource) Archive(ctx context.Context, ref string) (io.ReadCloser, error) {
	return d.svc.Archive(ctx, ref)
}

// DownloadSource is the service as the download queue sees it.
func (s *Service) DownloadSource() download.Source {
	return downloadSource{svc: s}
}
