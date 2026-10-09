package httpapi

type Source struct {
	ID     string `json:"id" example:"anilist" doc:"Stable source identifier."`
	Name   string `json:"name" example:"AniList" doc:"Name to show next to the data."`
	URL    string `json:"url" example:"https://anilist.co" doc:"Where the attribution links to."`
	Notice string `json:"notice,omitempty" doc:"Text the source's terms require next to its data, word for word."`
}

var (
	AniListSource = Source{ID: "anilist", Name: "AniList", URL: "https://anilist.co"}
	AniZipSource  = Source{ID: "anizip", Name: "ani.zip", URL: "https://ani.zip"}

	OpenLibrarySource = Source{ID: "openlibrary", Name: "Open Library", URL: "https://openlibrary.org"}
	TMDBSource        = Source{
		ID:     "tmdb",
		Name:   "TMDB",
		URL:    "https://www.themoviedb.org",
		Notice: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
	}
)
