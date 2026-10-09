package googlebooks

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// MaxResults is the most one search page may hold.
const MaxResults = 40

var volumeID = regexp.MustCompile(`^[A-Za-z0-9_-]{8,24}$`)

func ValidVolumeID(id string) bool {
	return volumeID.MatchString(id)
}

type Volume struct {
	ID         string     `json:"id"`
	VolumeInfo VolumeInfo `json:"volumeInfo"`
}

type VolumeInfo struct {
	Title               string     `json:"title"`
	Subtitle            string     `json:"subtitle"`
	Authors             []string   `json:"authors"`
	Publisher           string     `json:"publisher"`
	PublishedDate       string     `json:"publishedDate"`
	Description         string     `json:"description"`
	IndustryIdentifiers []Identity `json:"industryIdentifiers"`
	PageCount           *int       `json:"pageCount"`
	Categories          []string   `json:"categories"`
	AverageRating       *float64   `json:"averageRating"`
	RatingsCount        int        `json:"ratingsCount"`
	ImageLinks          ImageLinks `json:"imageLinks"`
	Language            string     `json:"language"`
	InfoLink            string     `json:"infoLink"`
	CanonicalVolumeLink string     `json:"canonicalVolumeLink"`
}

type Identity struct {
	Type       string `json:"type"`
	Identifier string `json:"identifier"`
}

type ImageLinks struct {
	SmallThumbnail string `json:"smallThumbnail"`
	Thumbnail      string `json:"thumbnail"`
	Small          string `json:"small"`
	Medium         string `json:"medium"`
	Large          string `json:"large"`
}

// Year is the year the edition came out; Google writes the date as precisely as
// it knows it: "2018", "2018-02" or "2018-02-05".
func (v *VolumeInfo) Year() *int {
	year, err := strconv.Atoi(v.PublishedDate[:min(len(v.PublishedDate), 4)])
	if err != nil || year <= 0 {
		return nil
	}

	return &year
}

// Cover is the largest picture the volume carries, over https and without the
// page curl Google paints on its thumbnails.
func (l ImageLinks) Cover() *string {
	for _, link := range []string{l.Large, l.Medium, l.Small, l.Thumbnail, l.SmallThumbnail} {
		if link == "" {
			continue
		}

		parsed, err := url.Parse(link)
		if err != nil {
			continue
		}

		parsed.Scheme = "https"

		query := parsed.Query()
		query.Del("edge")
		// A thumbnail is 128 pixels wide; asked for it, the same address serves a
		// picture fit for a poster.
		if query.Get("zoom") == "1" {
			query.Set("fife", "w600")
		}
		parsed.RawQuery = query.Encode()

		cover := parsed.String()

		return &cover
	}

	return nil
}

type SearchParams struct {
	// Query is Google's own query language: free text, and field clauses such as
	// intitle:, inauthor:, isbn:.
	Query      string
	StartIndex int
	MaxResults int
}

type SearchPage struct {
	TotalItems int      `json:"totalItems"`
	Items      []Volume `json:"items"`
}

func (c *Client) Search(ctx context.Context, params SearchParams) (*SearchPage, error) {
	query := url.Values{
		"q":          {params.Query},
		"printType":  {"books"},
		"startIndex": {strconv.Itoa(max(params.StartIndex, 0))},
		"maxResults": {strconv.Itoa(min(max(params.MaxResults, 1), MaxResults))},
	}

	var page SearchPage
	if err := c.call(ctx, "/volumes", query, &page); err != nil {
		return nil, err
	}

	return &page, nil
}

func (c *Client) Volume(ctx context.Context, id string) (*Volume, error) {
	var volume Volume
	if err := c.call(ctx, "/volumes/"+url.PathEscape(id), nil, &volume); err != nil {
		return nil, err
	}

	return &volume, nil
}

// ByISBN is the volume with this ISBN, or nil when Google knows none.
func (c *Client) ByISBN(ctx context.Context, isbn string) (*Volume, error) {
	page, err := c.Search(ctx, SearchParams{Query: "isbn:" + strings.TrimSpace(isbn), MaxResults: 1})
	if err != nil {
		return nil, err
	}

	if len(page.Items) == 0 {
		return nil, nil
	}

	return &page.Items[0], nil
}
