package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif" // registers the GIF decoder
	"image/jpeg"
	_ "image/png" // registers the PNG decoder
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // registers the WebP decoder

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/safehttp"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/imagesearch"
)

const (
	maxCoverBytes = 10 << 20

	// A poster is shown at most a few hundred pixels wide; keeping more only
	// costs disk and memory on every list that draws it.
	coverWidth = 600

	// Larger than any real poster, and small enough that a file claiming huge
	// dimensions is refused before it is decoded into memory.
	maxCoverPixels = 40_000_000
	minCoverSide   = 64

	coverQuality = 88
)

// CoverSource is where a new poster comes from: an address — a candidate the
// search found or one the user pasted — or a file the user picked.
type CoverSource struct {
	URL  string `json:"url,omitempty" maxLength:"2048" doc:"An http or https address of the picture. The node downloads it itself and refuses addresses on this computer or the local network."`
	Data []byte `json:"data,omitempty" doc:"The picture itself, base64-encoded, at most 10 MB."`
}

// CoverSearch is what a poster is looked for by: the title as the form has
// it, not a stored one, since the poster is picked while the title is still
// being described — before it exists.
type CoverSearch struct {
	MediaType string
	Title     string
	Year      *int
}

// SearchCovers looks for pictures that could be a title's poster, posters first.
func (s *Service) SearchCovers(ctx context.Context, search CoverSearch) ([]imagesearch.Image, error) {
	if _, known := manualFormats[search.MediaType]; !known {
		return nil, apperr.Invalid("type", "unknown media type %q", search.MediaType)
	}

	search.Title = strings.TrimSpace(search.Title)
	if search.Title == "" {
		return nil, apperr.Invalid("title", "a poster is looked for by the title's name")
	}

	if s.opts.Images == nil {
		return []imagesearch.Image{}, nil
	}

	found, err := s.opts.Images.Search(ctx, coverQuery(search))
	if err != nil {
		return nil, err
	}

	candidates := make([]imagesearch.Image, 0, len(found))
	for _, candidate := range found {
		if posterShaped(candidate) {
			candidates = append(candidates, candidate)
		}
	}

	return candidates, nil
}

func coverQuery(search CoverSearch) imagesearch.Query {
	name := search.Title
	parts := []string{name}

	if search.Year != nil {
		parts = append(parts, strconv.Itoa(*search.Year))
	}

	switch search.MediaType {
	case mediaTypeAnime:
		parts = append(parts, "anime poster")
	case mediaTypeManga:
		parts = append(parts, "manga cover")
	case MediaTypeBook:
		parts = append(parts, "book cover")
	case MediaTypeMovie:
		parts = append(parts, "film poster")
	default:
		parts = append(parts, "series poster")
	}

	noun := "poster"
	if search.MediaType == mediaTypeManga || search.MediaType == MediaTypeBook {
		noun = "cover"
	}

	return imagesearch.Query{Web: strings.Join(parts, " "), Commons: name + " " + noun}
}

// posterShaped keeps what could stand as a poster: taller than wide and big
// enough not to blur. A picture whose size the search did not say is kept.
func posterShaped(candidate imagesearch.Image) bool {
	if candidate.Width == 0 || candidate.Height == 0 {
		return true
	}

	return candidate.Width >= 200 && float64(candidate.Height) >= float64(candidate.Width)*1.1
}

// SetManualCover downloads or takes the picture, makes the node's own copy of it
// and points the title at it. The copy is re-encoded, so nothing but pixels of
// the original reaches the disk.
func (s *Service) SetManualCover(ctx context.Context, id string, source CoverSource) (*MediaDetails, error) {
	if _, err := s.manualForCover(ctx, id); err != nil {
		return nil, err
	}

	var (
		raw []byte
		err error
	)

	switch {
	case len(source.Data) > 0 && source.URL != "":
		return nil, apperr.Invalid("url", "give either an address or a file, not both")
	case len(source.Data) > 0:
		if len(source.Data) > maxCoverBytes {
			return nil, apperr.Invalid("data", "a picture is at most %d MB", maxCoverBytes>>20)
		}

		raw = source.Data
	case source.URL != "":
		raw, err = s.downloadCover(ctx, source.URL)
		if err != nil {
			return nil, err
		}
	default:
		return nil, apperr.Invalid("url", "give an address or a file")
	}

	encoded, color, err := processCover(raw)
	if err != nil {
		return nil, err
	}

	return s.storeCover(ctx, id, encoded, color)
}

// RemoveManualCover leaves the title without a poster.
func (s *Service) RemoveManualCover(ctx context.Context, id string) (*MediaDetails, error) {
	if _, err := s.manualForCover(ctx, id); err != nil {
		return nil, err
	}

	return s.storeCover(ctx, id, nil, "")
}

// ManualCoverPath is the file a manual title's poster is served from.
func (s *Service) ManualCoverPath(ctx context.Context, id string) (string, error) {
	if !manualID.MatchString(id) {
		return "", apperr.Invalid("id", "malformed manual title id %q", id)
	}

	row, err := s.store.ManualTitle(ctx, id)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read manual title")
	}
	if row == nil || row.Cover.File == "" || s.opts.CoverDir == "" {
		return "", apperr.New(apperr.KindNotFound, "manual title %q has no poster", id)
	}

	return filepath.Join(s.opts.CoverDir, row.Cover.File), nil
}

func (s *Service) manualForCover(ctx context.Context, id string) (*MediaDetails, error) {
	if s.opts.CoverDir == "" {
		return nil, apperr.New(apperr.KindPrecondition, "posters are turned off on this node")
	}

	if !manualID.MatchString(id) {
		return nil, apperr.Invalid("id", "malformed manual title id %q", id)
	}

	details, err := s.manualTitle(ctx, id)
	if err != nil {
		return nil, err
	}
	if details == nil {
		return nil, apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	return details, nil
}

func (s *Service) downloadCover(ctx context.Context, address string) ([]byte, error) {
	client := s.opts.Fetch
	if client == nil {
		return nil, apperr.New(apperr.KindPrecondition, "this node cannot download pictures")
	}

	response, err := safehttp.Get(ctx, client, strings.TrimSpace(address), http.Header{"Accept": {"image/*"}, "User-Agent": {s.opts.UserAgent}})
	if errors.Is(err, safehttp.ErrForbiddenAddress) {
		return nil, apperr.Invalid("url", "the address is not on the public internet")
	}
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "could not download the picture")
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusOK {
		return nil, apperr.New(apperr.KindUpstream, "the picture's site answered %d", response.StatusCode)
	}

	if kind := response.Header.Get("Content-Type"); kind != "" && !strings.HasPrefix(kind, "image/") {
		return nil, apperr.Invalid("url", "the address is not a picture but %s", kind)
	}

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxCoverBytes+1))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "could not download the picture")
	}

	if len(raw) > maxCoverBytes {
		return nil, apperr.Invalid("url", "the picture is larger than %d MB", maxCoverBytes>>20)
	}

	return raw, nil
}

// processCover decodes the picture — whatever its header claimed — scales it to
// the poster width and encodes it as JPEG, and finds the colour shown behind it
// while it loads.
func processCover(raw []byte) (poster []byte, background string, err error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, "", apperr.Invalid("data", "this is not a JPEG, PNG, GIF or WebP picture")
	}

	if config.Width < minCoverSide || config.Height < minCoverSide {
		return nil, "", apperr.Invalid("data", "the picture is too small for a poster")
	}

	if config.Width*config.Height > maxCoverPixels {
		return nil, "", apperr.Invalid("data", "the picture is too large")
	}

	source, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, "", apperr.Invalid("data", "the picture could not be read")
	}

	bounds := source.Bounds()
	width, height := bounds.Dx(), bounds.Dy()

	if width > coverWidth {
		height = height * coverWidth / width
		width = coverWidth
	}

	scaled := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(scaled, scaled.Bounds(), source, bounds, draw.Src, nil)

	var encoded bytes.Buffer
	if err = jpeg.Encode(&encoded, scaled, &jpeg.Options{Quality: coverQuality}); err != nil {
		return nil, "", apperr.Wrap(err, apperr.KindInternal, "encode poster")
	}

	return encoded.Bytes(), averageColor(scaled), nil
}

// averageColor is the poster's mean colour, as a hex string.
func averageColor(img *image.RGBA) string {
	var red, green, blue, count uint64

	bounds := img.Bounds()
	step := max(1, bounds.Dx()/48)

	for y := bounds.Min.Y; y < bounds.Max.Y; y += step {
		for x := bounds.Min.X; x < bounds.Max.X; x += step {
			offset := img.PixOffset(x, y)
			red += uint64(img.Pix[offset])
			green += uint64(img.Pix[offset+1])
			blue += uint64(img.Pix[offset+2])
			count++
		}
	}

	if count == 0 {
		return ""
	}

	return fmt.Sprintf("#%02x%02x%02x", red/count, green/count, blue/count)
}

// storeCover writes the new file under a fresh name, points the title at it and
// only then removes the old one: a crash in between leaves an orphan file, never
// a title pointing at nothing. Nil data removes the poster.
func (s *Service) storeCover(ctx context.Context, id string, data []byte, color string) (*MediaDetails, error) {
	existing, err := s.store.ManualTitle(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read manual title")
	}
	if existing == nil {
		return nil, apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	file := ""

	if data != nil {
		if mkdirErr := os.MkdirAll(s.opts.CoverDir, 0o700); mkdirErr != nil {
			return nil, apperr.Wrap(mkdirErr, apperr.KindInternal, "create posters folder")
		}

		var suffix [4]byte
		if _, randErr := rand.Read(suffix[:]); randErr != nil {
			return nil, apperr.Wrap(randErr, apperr.KindInternal, "name poster file")
		}

		file = id + "-" + hex.EncodeToString(suffix[:]) + ".jpg"

		temporary := filepath.Join(s.opts.CoverDir, file+".tmp")
		if writeErr := os.WriteFile(temporary, data, 0o600); writeErr != nil {
			return nil, apperr.Wrap(writeErr, apperr.KindInternal, "write poster")
		}

		if renameErr := os.Rename(temporary, filepath.Join(s.opts.CoverDir, file)); renameErr != nil {
			_ = os.Remove(temporary)
			return nil, apperr.Wrap(renameErr, apperr.KindInternal, "write poster")
		}
	}

	updated, err := s.store.SetManualCover(ctx, id, file, color, s.opts.Now())
	if err != nil || !updated {
		s.removeCoverFile(file)

		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "store poster")
		}

		return nil, apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	s.removeCoverFile(existing.Cover.File)

	return s.manualTitle(ctx, id)
}

func (s *Service) removeCoverFile(file string) {
	if file == "" || s.opts.CoverDir == "" {
		return
	}

	if err := os.Remove(filepath.Join(s.opts.CoverDir, file)); err != nil && !errors.Is(err, os.ErrNotExist) {
		s.logger.Warn().Err(err).Str("file", file).Msg("remove an old poster")
	}
}

// ImageSearchSettings is how the node finds posters. The key itself never
// leaves it.
type ImageSearchSettings struct {
	Enabled   bool   `json:"enabled" doc:"Whether this node can look for posters at all."`
	KeySource string `json:"key_source" enum:"user,none" doc:"Whether the user saved their own Brave Search key. Without one only Wikimedia Commons is searched, which rarely has posters."`
}

func (s *Service) ImageSearchSettings() (*ImageSearchSettings, error) {
	if s.opts.Images == nil {
		return &ImageSearchSettings{KeySource: "none"}, nil
	}

	key, err := s.opts.Images.Keys().Key()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read brave api key")
	}

	source := "none"
	if key != "" {
		source = "user"
	}

	return &ImageSearchSettings{Enabled: true, KeySource: source}, nil
}

// SetBraveKey stores the user's own Brave Search key after Brave has accepted
// it. An empty key forgets it.
func (s *Service) SetBraveKey(ctx context.Context, key string) (*ImageSearchSettings, error) {
	if s.opts.Images == nil {
		return nil, apperr.New(apperr.KindPrecondition, "poster search is turned off on this node")
	}

	key = strings.TrimSpace(key)

	if key != "" {
		if err := s.opts.Images.Check(ctx, key); err != nil {
			return nil, err
		}
	}

	if err := s.opts.Images.Keys().SetUserKey(key); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store brave api key")
	}

	return s.ImageSearchSettings()
}
