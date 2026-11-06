package app

import (
	"context"
	"unicode"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/media"
)

// releaseTitles names a title for a torrent search, from the details the node
// already fetched when the title page was opened. Release names are written in
// Latin letters, so a native or Cyrillic name only finds less.
type releaseTitles struct {
	media *media.Module
}

func (r releaseTitles) Names(ctx context.Context, mediaRef string) ([]string, error) {
	details, err := r.media.Cached(ctx, mediaRef)
	if err != nil || details == nil {
		return nil, err
	}

	var names []string
	for _, name := range []*string{details.Title.English, details.Title.Romaji} {
		if name != nil {
			names = append(names, *name)
		}
	}

	for _, synonym := range details.Synonyms {
		if latin(synonym) {
			names = append(names, synonym)
		}
	}

	return names, nil
}

func (r releaseTitles) TotalEpisodes(ctx context.Context, mediaRef string) (*int, error) {
	details, err := r.media.Cached(ctx, mediaRef)
	if err != nil || details == nil {
		return nil, err
	}

	return details.Episodes, nil
}

func latin(name string) bool {
	letters := 0
	for _, r := range name {
		if !unicode.IsLetter(r) {
			continue
		}
		if r > unicode.MaxLatin1 && !unicode.Is(unicode.Latin, r) {
			return false
		}
		letters++
	}

	return letters > 0
}
