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
// its reference. Chapters on the user's OPDS servers and from manga plugins;
// MangaDex says nothing of keeping its pages, so its chapters are read only.

func (s *Service) Describe(ctx context.Context, ref string) (*download.Chapter, error) {
	if id, key, ok := pluginRef(ref); ok {
		return s.describePlugin(ctx, id, key)
	}

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
	if id, key, ok := pluginRef(ref); ok {
		return s.PluginPage(ctx, id, key, index)
	}

	serverID, key, err := opdsRef(ref)
	if err != nil {
		return nil, "", err
	}

	return s.Page(ctx, serverID, key, index)
}

func (s *Service) Archive(ctx context.Context, ref string) (io.ReadCloser, error) {
	if _, _, ok := pluginRef(ref); ok {
		return nil, apperr.New(apperr.KindPrecondition, "a plugin gives a chapter page by page only")
	}

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

// describePlugin is a plugin's chapter as the queue saves it: its pages counted
// now, its title the one the user linked.
func (s *Service) describePlugin(ctx context.Context, id, rawKey string) (*download.Chapter, error) {
	key, err := decodePluginKey(rawKey)
	if err != nil {
		return nil, err
	}

	p, pages, err := s.pluginPages(ctx, id, key.Chapter)
	if err != nil {
		return nil, err
	}

	chapter := &download.Chapter{Number: key.Number, Title: key.Title, SourceName: p.Name, Pages: len(pages)}

	link, err := s.store.LinkBySeries(ctx, SourcePrefixPlugin+id, key.Series)
	if err != nil {
		return nil, err
	}
	if link != nil {
		chapter.MediaRef = link.MediaRef
		chapter.Series = link.SeriesTitle
	}

	return chapter, nil
}

// pluginRef reads plugin:<id>:<key>.
func pluginRef(ref string) (id, key string, ok bool) {
	rest, ok := strings.CutPrefix(ref, SourcePrefixPlugin)
	if !ok {
		return "", "", false
	}

	id, key, ok = strings.Cut(rest, ":")

	return id, key, ok && id != "" && key != ""
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
