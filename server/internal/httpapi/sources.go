package httpapi

type Source struct {
	ID   string `json:"id" example:"anilist" doc:"Stable source identifier."`
	Name string `json:"name" example:"AniList" doc:"Name to show next to the data."`
	URL  string `json:"url" example:"https://anilist.co" doc:"Where the attribution links to."`
}

var AniListSource = Source{ID: "anilist", Name: "AniList", URL: "https://anilist.co"}
