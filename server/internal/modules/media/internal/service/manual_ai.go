package service

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/mediaryorg/mediary-node/server/internal/platform/ai"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const maxManualNote = 1000

// ManualHint is what the user knows about a title before the AI fills in the rest.
type ManualHint struct {
	MediaType string `json:"media_type" enum:"anime,manga,movie,series,dorama,book" doc:"The kind of title, as the user chose it. The AI does not change it."`
	Title     string `json:"title" minLength:"1" maxLength:"300" doc:"The name as the user knows it. The AI does not change it either."`
	Year      *int   `json:"year,omitempty" minimum:"1800" maximum:"2100" doc:"Year it came out, when the user knows it: it tells apart titles of the same name."`
	Note      string `json:"note,omitempty" maxLength:"1000" doc:"Anything else the user knows — the studio, the country, the original name — to tell the AI which title is meant."`
	Language  string `json:"language,omitempty" enum:"en,uk,ru" default:"en" doc:"The language to write the description in: the app's own."`
}

type ManualSuggestion struct {
	Draft      ManualDraft `json:"draft" doc:"The title as the AI knows it, cleaned the way a draft the user typed is. Nothing is stored: the client shows it for the user to check and saves it like any other draft."`
	Recognized bool        `json:"recognized" doc:"Whether the AI knew this title at all. When it did not, the draft carries little beyond the hint, by design: an unknown title gets no invented details."`
	Model      string      `json:"model" doc:"The model that answered."`
}

type suggestionAnswer struct {
	Recognized      bool     `json:"recognized"`
	OriginalTitle   *string  `json:"original_title"`
	Synonyms        []string `json:"synonyms"`
	Description     string   `json:"description"`
	Format          *string  `json:"format"`
	Status          *string  `json:"status"`
	Year            *int     `json:"year"`
	EndYear         *int     `json:"end_year"`
	Seasons         *int     `json:"seasons"`
	Episodes        *int     `json:"episodes"`
	Chapters        *int     `json:"chapters"`
	Volumes         *int     `json:"volumes"`
	Pages           *int     `json:"pages"`
	Duration        *int     `json:"duration"`
	Genres          []string `json:"genres"`
	Studios         []string `json:"studios"`
	Authors         []string `json:"authors"`
	CountryOfOrigin *string  `json:"country_of_origin"`
	IsAdult         bool     `json:"is_adult"`
}

var suggestionLanguages = map[string]string{"en": "English", "uk": "Ukrainian", "ru": "Russian"}

const suggestionSystem = `You fill in catalog details for one media title so a person can track it in their library. The catalogs they normally use do not have it, so it is often obscure: a short film, a fan translation, a regional release, an old book.

Answer only from what you actually know about this specific title. A wrong detail is worse than a missing one: the person will trust what you give them. When you are not sure of a field, use null or an empty list instead of guessing — episode counts, runtimes, years and names above all. Do not fill a field from what similar titles usually have.

If you do not recognise the title from the name and the hints, set recognized to false and leave every field empty except what the person's own words state directly.

The description is a plain-text synopsis of two to four sentences, without spoilers, in the language you are asked for. Genres are short, common English names such as Drama, Comedy, Romance, Slice of Life, Science Fiction. Synonyms are other names the title is really known by, in any script — not translations you make up. Duration is minutes per episode, or the runtime of a movie. End year is the year the last episode or volume came out, for a finished title only. Seasons counts the seasons of a series.`

func (s *Service) SuggestManual(ctx context.Context, hint ManualHint) (*ManualSuggestion, error) {
	formats, known := manualFormats[hint.MediaType]
	if !known {
		return nil, apperr.Invalid("media_type", "unknown media type %q", hint.MediaType)
	}

	hint.Title = strings.TrimSpace(hint.Title)
	if hint.Title == "" {
		return nil, apperr.Invalid("title", "the AI needs at least the name")
	}

	hint.Note = strings.TrimSpace(hint.Note)
	if utf8.RuneCountInString(hint.Note) > maxManualNote {
		return nil, apperr.Invalid("note", "a note is at most %d characters", maxManualNote)
	}

	provider, err := s.activeAI()
	if err != nil {
		return nil, err
	}

	answer, err := provider.Structured(ctx, ai.Request{
		System: suggestionSystem,
		Prompt: suggestionPrompt(hint),
		Schema: suggestionSchema(formats),
	})
	if err != nil {
		return nil, err
	}

	var parsed suggestionAnswer
	if decodeErr := json.Unmarshal(answer.JSON, &parsed); decodeErr != nil {
		return nil, apperr.Wrap(decodeErr, apperr.KindUpstream, "the AI answered in a shape the node cannot read")
	}

	suggested := ManualDraft{MediaType: hint.MediaType, Title: hint.Title, Year: hint.Year}

	// Whatever comes with a title the AI says it does not know is a guess, which
	// is exactly what the user must not be handed as fact.
	if parsed.Recognized {
		suggested = draftFromSuggestion(hint, parsed)
	}

	draft, err := normalizeManual(suggested)
	if err != nil {
		// A value the schema could not rule out — a year of 3000 — is the AI's
		// mistake, not the user's; they get the fields that were fine.
		draft, err = normalizeManual(ManualDraft{MediaType: hint.MediaType, Title: hint.Title, Year: hint.Year})
		if err != nil {
			return nil, err
		}
	}

	return &ManualSuggestion{Draft: draft, Recognized: parsed.Recognized, Model: answer.Model}, nil
}

func suggestionPrompt(hint ManualHint) string {
	var prompt strings.Builder

	fmt.Fprintf(&prompt, "Kind of title: %s\n", hint.MediaType)
	fmt.Fprintf(&prompt, "Name: %s\n", hint.Title)

	if hint.Year != nil {
		fmt.Fprintf(&prompt, "Year: %d\n", *hint.Year)
	}

	if hint.Note != "" {
		fmt.Fprintf(&prompt, "What the person also knows: %s\n", hint.Note)
	}

	language, ok := suggestionLanguages[hint.Language]
	if !ok {
		language = suggestionLanguages["en"]
	}

	fmt.Fprintf(&prompt, "\nWrite the description in %s.", language)

	return prompt.String()
}

func nullable(kind string) map[string]any {
	return map[string]any{"anyOf": []any{map[string]any{"type": kind}, map[string]any{"type": "null"}}}
}

func nullableEnum(values []string) map[string]any {
	return map[string]any{"anyOf": []any{map[string]any{"type": "string", "enum": values}, map[string]any{"type": "null"}}}
}

func stringList() map[string]any {
	return map[string]any{"type": "array", "items": map[string]any{"type": "string"}}
}

// suggestionSchema allows only the formats of the kind the user chose, so a
// movie cannot come back as an OVA.
func suggestionSchema(formats []string) map[string]any {
	properties := map[string]any{
		"recognized":        map[string]any{"type": "boolean"},
		"original_title":    nullable("string"),
		"synonyms":          stringList(),
		"description":       map[string]any{"type": "string"},
		"format":            nullableEnum(formats),
		"status":            nullableEnum(manualStatuses),
		"year":              nullable("integer"),
		"end_year":          nullable("integer"),
		"seasons":           nullable("integer"),
		"episodes":          nullable("integer"),
		"chapters":          nullable("integer"),
		"volumes":           nullable("integer"),
		"pages":             nullable("integer"),
		"duration":          nullable("integer"),
		"genres":            stringList(),
		"studios":           stringList(),
		"authors":           stringList(),
		"country_of_origin": nullable("string"),
		"is_adult":          map[string]any{"type": "boolean"},
	}

	// Sorted, so the schema is the same bytes on every request and Anthropic
	// compiles it once rather than per call.
	required := make([]string, 0, len(properties))
	for name := range properties {
		required = append(required, name)
	}
	slices.Sort(required)

	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}

// draftFromSuggestion keeps the user's own words for what they gave: the kind,
// the name and the year are theirs, not the AI's.
func draftFromSuggestion(hint ManualHint, answer suggestionAnswer) ManualDraft {
	year := hint.Year
	if year == nil {
		year = answer.Year
	}

	// The user's year outranks the AI's, so an end the AI put before it is the
	// part to drop.
	endYear := answer.EndYear
	if endYear != nil && year != nil && *endYear < *year {
		endYear = nil
	}

	country := answer.CountryOfOrigin
	if country != nil {
		upper := strings.ToUpper(strings.TrimSpace(*country))
		country = &upper

		if len(upper) != 2 {
			country = nil
		}
	}

	return ManualDraft{
		MediaType:       hint.MediaType,
		Title:           hint.Title,
		OriginalTitle:   answer.OriginalTitle,
		Synonyms:        answer.Synonyms,
		Description:     answer.Description,
		Format:          answer.Format,
		Status:          answer.Status,
		Year:            year,
		EndYear:         endYear,
		Seasons:         answer.Seasons,
		Episodes:        answer.Episodes,
		Chapters:        answer.Chapters,
		Volumes:         answer.Volumes,
		Pages:           answer.Pages,
		Duration:        answer.Duration,
		Genres:          answer.Genres,
		Studios:         answer.Studios,
		Authors:         answer.Authors,
		CountryOfOrigin: country,
		IsAdult:         answer.IsAdult,
	}
}
