package sandbox

import (
	"encoding/base32"
	"encoding/hex"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dop251/goja"
)

const (
	maxTitle  = 500
	maxMagnet = 8192
	maxURL    = 2048
	maxCount  = 10_000_000
	maxSize   = 1 << 50
)

// releases reads what search returned: an array of objects, of which only the
// known fields are looked at. A release without a title or without a way to
// get it is left out; the rest of the search still counts.
func (s *session) releases(value goja.Value) ([]Release, error) {
	array, ok := value.(*goja.Object)
	if !ok || array.ClassName() != "Array" {
		return nil, &Error{Plugin: s.plugin.ID, Message: "search has to return an array of releases"}
	}

	length := int(array.Get("length").ToInteger())
	if length > s.limits.MaxResults {
		s.logger.Warn().Int("returned", length).Int("kept", s.limits.MaxResults).Msg("the plugin returned more releases than a search keeps")
		length = s.limits.MaxResults
	}

	out := make([]Release, 0, length)
	skipped := 0

	for i := range length {
		item, isObj := array.Get(strconv.Itoa(i)).(*goja.Object)
		if !isObj {
			skipped++
			continue
		}

		release, keep := s.release(item)
		if !keep {
			skipped++
			continue
		}
		out = append(out, release)
	}

	if skipped > 0 {
		s.logger.Info().Int("skipped", skipped).Msg("releases without a title or a way to get them were left out")
	}

	return out, nil
}

func (s *session) release(item *goja.Object) (Release, bool) {
	r := Release{
		Title:   clean(text(item, "title")),
		Size:    clamp(number(item, "size"), maxSize),
		Seeders: int(clamp(number(item, "seeders"), maxCount)),
		Peers:   int(clamp(number(item, "peers"), maxCount)),
		Grabs:   int(clamp(number(item, "grabs"), maxCount)),
	}

	if r.Title == "" || len(r.Title) > maxTitle {
		return Release{}, false
	}

	if magnet := text(item, "magnet"); strings.HasPrefix(magnet, "magnet:?") && len(magnet) <= maxMagnet {
		r.Magnet = magnet
	}

	// The node downloads this file itself, later and outside the sandbox: it
	// has to be on the plugin's hosts like everything the plugin fetches.
	if link := text(item, "link"); link != "" && len(link) <= maxURL {
		if u, err := url.Parse(link); err == nil && s.hosts.checkURL(u) == nil {
			r.Link = link
		}
	}

	r.InfoHash = infoHash(text(item, "infoHash"))

	if r.Magnet == "" && r.Link == "" && r.InfoHash == "" {
		return Release{}, false
	}

	if at, err := time.Parse(time.RFC3339, text(item, "publishedAt")); err == nil {
		at = at.UTC()
		r.PublishedAt = &at
	}

	// Shown to the user to open; any site, but only a web address.
	if page := text(item, "pageUrl"); page != "" && len(page) <= maxURL {
		if u, err := url.Parse(page); err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != "" {
			r.PageURL = page
		}
	}

	return r, true
}

// text reads a string field; anything that is not a string reads as empty.
func text(obj *goja.Object, key string) string {
	value := obj.Get(key)
	if value == nil {
		return ""
	}

	str, ok := value.Export().(string)
	if !ok {
		return ""
	}

	return str
}

// number reads a count or a size, as a number or as digits in a string.
func number(obj *goja.Object, key string) int64 {
	value := obj.Get(key)
	if value == nil || goja.IsUndefined(value) || goja.IsNull(value) {
		return 0
	}

	switch v := value.Export().(type) {
	case int64:
		return v
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0
		}
		return int64(v)
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		if err != nil {
			return 0
		}
		return n
	}

	return 0
}

func clamp(n, high int64) int64 {
	switch {
	case n < 0:
		return 0
	case n > high:
		return high
	}

	return n
}

// clean folds a title's whitespace: a name copied out of a table cell keeps
// its line breaks and indentation otherwise.
func clean(title string) string {
	return strings.Join(strings.Fields(title), " ")
}

// infoHash takes a v1 hash as 40 hex characters or 32 base32 ones, and gives
// lowercase hex; anything else is no hash.
func infoHash(raw string) string {
	raw = strings.TrimSpace(raw)

	switch len(raw) {
	case 40:
		if _, err := hex.DecodeString(raw); err == nil {
			return strings.ToLower(raw)
		}
	case 32:
		if decoded, err := base32.StdEncoding.DecodeString(strings.ToUpper(raw)); err == nil && len(decoded) == 20 {
			return hex.EncodeToString(decoded)
		}
	}

	return ""
}
