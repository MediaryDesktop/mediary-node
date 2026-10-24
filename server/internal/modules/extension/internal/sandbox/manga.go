package sandbox

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/dop251/goja"
)

const (
	// An id is the site's own and goes back to it as it came; it only has to
	// fit in a chapter reference.
	maxID       = 512
	maxNumber   = 32
	maxLanguage = 35
	maxGroups   = 10
	maxChapters = 5000
	maxPages    = 2000
	// maxImage is the largest page the node takes: a long webtoon strip.
	maxImage = 20 << 20
)

// MangaSearchRequest is what a manga provider is asked to find.
type MangaSearchRequest struct {
	Query     string
	Titles    []string
	AniListID int
}

// Series is a series a manga provider found.
type Series struct {
	ID     string
	Title  string
	Detail string
}

// Chapter is one chapter of a series, checked.
type Chapter struct {
	ID          string
	Number      string
	Title       string
	Volume      string
	Language    string
	Groups      []string
	PublishedAt *time.Time
}

// Page is where one page's image is: on the plugin's hosts, as checked.
type Page struct {
	URL     string
	Referer string
}

// MangaSearch runs a manga provider's search.
func (r *Runner) MangaSearch(ctx context.Context, plugin Plugin, request MangaSearchRequest) ([]Series, error) {
	var series []Series

	err := r.call(ctx, plugin, "search",
		func(s *session) goja.Value {
			obj := s.vm.NewObject()
			_ = obj.Set("query", request.Query)
			titles := make([]any, 0, len(request.Titles))
			for _, title := range request.Titles {
				titles = append(titles, title)
			}
			_ = obj.Set("titles", s.vm.NewArray(titles...))
			if request.AniListID > 0 {
				_ = obj.Set("anilistId", request.AniListID)
			}
			return obj
		},
		func(s *session, result goja.Value) (err error) {
			series, err = readList(s, result, "series", s.limits.MaxResults, s.series)
			return err
		})

	return series, err
}

// MangaChapters asks a manga provider for a series' chapters.
func (r *Runner) MangaChapters(ctx context.Context, plugin Plugin, seriesID string) ([]Chapter, error) {
	var chapters []Chapter

	err := r.call(ctx, plugin, "chapters",
		func(s *session) goja.Value { return s.vm.ToValue(seriesID) },
		func(s *session, result goja.Value) (err error) {
			chapters, err = readList(s, result, "chapters", maxChapters, s.chapter)
			return err
		})

	return chapters, err
}

// MangaPages asks a manga provider where a chapter's pages are.
func (r *Runner) MangaPages(ctx context.Context, plugin Plugin, chapterID string) ([]Page, error) {
	var pages []Page

	err := r.call(ctx, plugin, "pages",
		func(s *session) goja.Value { return s.vm.ToValue(chapterID) },
		func(s *session, result goja.Value) (err error) {
			pages, err = readList(s, result, "pages", maxPages, s.page)
			if err == nil && len(pages) == 0 {
				err = &Error{Plugin: s.plugin.ID, Message: "the chapter has no pages the node can fetch"}
			}
			return err
		})

	return pages, err
}

// readList reads an array the plugin returned, keeping the items read accepts.
// A page left out would shift every page after it, so pages are all or none.
func readList[T any](s *session, value goja.Value, what string, limit int, read func(*goja.Object) (T, bool)) ([]T, error) {
	array, ok := value.(*goja.Object)
	if !ok || array.ClassName() != "Array" {
		return nil, &Error{Plugin: s.plugin.ID, Message: what + " has to be an array"}
	}

	length := int(array.Get("length").ToInteger())
	if length > limit {
		if what == "pages" {
			return nil, &Error{Plugin: s.plugin.ID, Message: fmt.Sprintf("a chapter of more than %d pages", limit)}
		}
		s.logger.Warn().Int("returned", length).Int("kept", limit).Msgf("the plugin returned more %s than the node keeps", what)
		length = limit
	}

	out := make([]T, 0, length)
	skipped := 0

	for i := range length {
		item, isObj := array.Get(strconv.Itoa(i)).(*goja.Object)
		if !isObj {
			skipped++
			continue
		}

		found, keep := read(item)
		if !keep {
			skipped++
			continue
		}
		out = append(out, found)
	}

	if skipped > 0 {
		if what == "pages" {
			return nil, &Error{Plugin: s.plugin.ID, Message: fmt.Sprintf("%d of the pages are not on the plugin's sites or have no address", skipped)}
		}
		s.logger.Info().Int("skipped", skipped).Msgf("%s without an id or a title were left out", what)
	}

	return out, nil
}

func (s *session) series(item *goja.Object) (Series, bool) {
	found := Series{
		ID:     id(text(item, "id")),
		Title:  limitText(clean(text(item, "title")), maxTitle),
		Detail: limitText(clean(text(item, "detail")), maxTitle),
	}

	return found, found.ID != "" && found.Title != ""
}

func (s *session) chapter(item *goja.Object) (Chapter, bool) {
	found := Chapter{
		ID:       id(text(item, "id")),
		Number:   limitText(chapterNumber(item), maxNumber),
		Title:    limitText(clean(text(item, "title")), maxTitle),
		Volume:   limitText(clean(text(item, "volume")), maxNumber),
		Language: limitText(clean(text(item, "language")), maxLanguage),
	}

	if groups, ok := item.Get("groups").(*goja.Object); ok && groups.ClassName() == "Array" {
		for i := range min(int(groups.Get("length").ToInteger()), maxGroups) {
			name, _ := groups.Get(strconv.Itoa(i)).Export().(string)
			if name = limitText(clean(name), maxTitle); name != "" {
				found.Groups = append(found.Groups, name)
			}
		}
	}

	if at, err := time.Parse(time.RFC3339, text(item, "publishedAt")); err == nil {
		at = at.UTC()
		found.PublishedAt = &at
	}

	return found, found.ID != ""
}

func (s *session) page(item *goja.Object) (Page, bool) {
	link := text(item, "url")
	u, err := url.Parse(link)
	if err != nil || len(link) > maxURL || s.hosts.checkURL(u) != nil {
		return Page{}, false
	}

	found := Page{URL: link}

	// A referer elsewhere would tell another site what the user reads.
	if referer := text(item, "referer"); referer != "" && len(referer) <= maxURL {
		if r, parseErr := url.Parse(referer); parseErr == nil && s.hosts.checkURL(r) == nil {
			found.Referer = referer
		}
	}

	return found, true
}

// chapterNumber takes "13", "13.5" or 13 alike.
func chapterNumber(item *goja.Object) string {
	value := item.Get("number")
	if value == nil || goja.IsUndefined(value) || goja.IsNull(value) {
		return ""
	}

	switch v := value.Export().(type) {
	case string:
		return clean(v)
	case int64:
		if v < 0 {
			return ""
		}
		return strconv.FormatInt(v, 10)
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
			return ""
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	}

	return ""
}

// id is the site's id as it came, or "" for one the node cannot hand back.
func id(raw string) string {
	if raw == "" || len(raw) > maxID || strings.IndexFunc(raw, unicode.IsControl) >= 0 {
		return ""
	}

	return raw
}

func limitText(text string, limit int) string {
	if len(text) <= limit {
		return text
	}

	return strings.ToValidUTF8(text[:limit], "")
}

// FetchImage downloads one page's image for the reader or a saved chapter. The
// node does this itself, outside the script, under the plugin's own rule: a
// host on its list, on every redirect, at a public address.
func (r *Runner) FetchImage(ctx context.Context, plugin Plugin, page Page) (data []byte, contentType string, err error) {
	h := hosts(plugin.Network)

	target, err := url.Parse(page.URL)
	if err != nil {
		return nil, "", fmt.Errorf("%q is not an address", page.URL)
	}
	if checkErr := h.checkURL(target); checkErr != nil {
		return nil, "", checkErr
	}

	ctx, cancel := context.WithTimeout(ctx, r.limits.Request)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), http.NoBody)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", r.userAgent)
	req.Header.Set("Accept", "image/*")
	if page.Referer != "" {
		if ref, refErr := url.Parse(page.Referer); refErr == nil && h.checkURL(ref) == nil {
			req.Header.Set("Referer", page.Referer)
		}
	}

	resp, err := clientFor(r.transport, h).Do(req)
	if err != nil {
		return nil, "", errors.New(reason(err))
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("the site answered %s for the page", resp.Status)
	}

	data, err = io.ReadAll(io.LimitReader(resp.Body, maxImage+1))
	if err != nil {
		return nil, "", errors.New(reason(err))
	}
	if len(data) > maxImage {
		return nil, "", fmt.Errorf("the page is larger than %d MB", maxImage>>20)
	}

	// What the bytes are, not what the site says: a page that is an HTML error
	// or a challenge is not an image to show.
	contentType = imageType(data)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, "", fmt.Errorf("the page is not an image (%s)", contentType)
	}

	return data, contentType, nil
}

// imageType sniffs the bytes, AVIF included, which net/http does not know.
func imageType(data []byte) string {
	if len(data) >= 12 && string(data[4:8]) == "ftyp" && (string(data[8:12]) == "avif" || string(data[8:12]) == "avis") {
		return "image/avif"
	}

	return http.DetectContentType(data)
}
