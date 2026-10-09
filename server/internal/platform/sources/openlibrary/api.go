package openlibrary

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const coverBase = "https://covers.openlibrary.org/b/id/"

// docFields are the search fields a book card and page need; asking for fewer
// keeps a search answer small.
const docFields = "key,title,subtitle,author_name,first_publish_year,cover_i," +
	"number_of_pages_median,ratings_average,ratings_count,subject,language"

var workID = regexp.MustCompile(`^OL[1-9]\d*W$`)

// ValidWorkID reports whether id is a work identifier such as OL893414W.
func ValidWorkID(id string) bool {
	return workID.MatchString(id)
}

// CoverURL links a cover by its id. Size is "S", "M" or "L"; covers by id are not
// rate-limited, unlike those by ISBN.
func CoverURL(id *int, size string) *string {
	if id == nil || *id <= 0 {
		return nil
	}

	link := coverBase + strconv.Itoa(*id) + "-" + size + ".jpg"

	return &link
}

// Doc is a work as the search index has it: everything a card needs in one place,
// author names included, which the work itself only references.
type Doc struct {
	Key              string   `json:"key"`
	Title            string   `json:"title"`
	Subtitle         string   `json:"subtitle"`
	AuthorName       []string `json:"author_name"`
	FirstPublishYear *int     `json:"first_publish_year"`
	CoverID          *int     `json:"cover_i"`
	Pages            *int     `json:"number_of_pages_median"`
	RatingsAverage   *float64 `json:"ratings_average"`
	RatingsCount     int      `json:"ratings_count"`
	Subject          []string `json:"subject"`
	Language         []string `json:"language"`
}

// WorkID is the work's identifier without the "/works/" prefix.
func (d *Doc) WorkID() string {
	return strings.TrimPrefix(d.Key, "/works/")
}

type SearchParams struct {
	// Query is Open Library's own query language: free text, and field clauses
	// such as subject:"fantasy" or ratings_count:[100 TO *].
	Query string
	// Sort is one of Open Library's sorts — rating, readinglog, new, title — or
	// empty for relevance.
	Sort  string
	Page  int
	Limit int
}

type SearchPage struct {
	NumFound int   `json:"numFound"`
	Docs     []Doc `json:"docs"`
}

func (c *Client) Search(ctx context.Context, params SearchParams) (*SearchPage, error) {
	query := url.Values{
		"q":      {params.Query},
		"fields": {docFields},
		"page":   {strconv.Itoa(max(params.Page, 1))},
		"limit":  {strconv.Itoa(max(params.Limit, 1))},
	}
	if params.Sort != "" {
		query.Set("sort", params.Sort)
	}

	var page SearchPage
	if err := c.get(ctx, "/search.json", query, &page); err != nil {
		return nil, err
	}

	return &page, nil
}

// WorkDoc is one work's search entry, for the names of its authors and the
// figures the work record lacks.
func (c *Client) WorkDoc(ctx context.Context, id string) (*Doc, error) {
	page, err := c.Search(ctx, SearchParams{Query: "key:/works/" + id, Limit: 1})
	if err != nil {
		return nil, err
	}

	if len(page.Docs) == 0 {
		return nil, apperr.New(apperr.KindNotFound, "Open Library has no such book")
	}

	return &page.Docs[0], nil
}

// Text is a field Open Library stores either as a plain string or as
// {"type": "/type/text", "value": "..."}.
type Text string

func (t *Text) UnmarshalJSON(raw []byte) error {
	var plain string
	if err := json.Unmarshal(raw, &plain); err == nil {
		*t = Text(plain)
		return nil
	}

	var typed struct {
		Value string `json:"value"`
	}
	if err := json.Unmarshal(raw, &typed); err != nil {
		return err
	}

	*t = Text(typed.Value)

	return nil
}

type Work struct {
	Key              string   `json:"key"`
	Title            string   `json:"title"`
	Subtitle         string   `json:"subtitle"`
	Description      Text     `json:"description"`
	Subjects         []string `json:"subjects"`
	Covers           []int    `json:"covers"`
	FirstPublishDate string   `json:"first_publish_date"`
}

func (c *Client) Work(ctx context.Context, id string) (*Work, error) {
	if !ValidWorkID(id) {
		return nil, apperr.Invalid("media_ref", "%q is not an Open Library work", id)
	}

	var work Work
	if err := c.get(ctx, "/works/"+id+".json", nil, &work); err != nil {
		return nil, err
	}

	return &work, nil
}

type Edition struct {
	Key   string `json:"key"`
	Title string `json:"title"`
	Works []struct {
		Key string `json:"key"`
	} `json:"works"`
	Pages *int `json:"number_of_pages"`
}

// WorkID is the work this edition is of, or "" when the record names none.
func (e *Edition) WorkID() string {
	if len(e.Works) == 0 {
		return ""
	}

	return strings.TrimPrefix(e.Works[0].Key, "/works/")
}

// EditionByISBN finds the edition with this ISBN — the exact way from a book file
// that carries one to its work.
func (c *Client) EditionByISBN(ctx context.Context, isbn string) (*Edition, error) {
	clean := strings.Map(func(r rune) rune {
		if (r >= '0' && r <= '9') || r == 'X' || r == 'x' {
			return r
		}
		return -1
	}, isbn)

	if len(clean) != 10 && len(clean) != 13 {
		return nil, apperr.Invalid("isbn", "%q is not an ISBN", isbn)
	}

	var edition Edition
	if err := c.get(ctx, "/isbn/"+strings.ToUpper(clean)+".json", nil, &edition); err != nil {
		return nil, err
	}

	return &edition, nil
}
