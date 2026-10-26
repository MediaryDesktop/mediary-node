package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/service"
)

type Handler struct {
	svc   *service.Service
	queue *download.Queue
}

func New(svc *service.Service, queue *download.Queue) *Handler {
	return &Handler{svc: svc, queue: queue}
}

type OPDSServerBody struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url" doc:"Address of the catalogue's root feed."`
	Username    string `json:"username,omitempty"`
	HasPassword bool   `json:"has_password" doc:"Whether a password is stored. The password itself is never sent back."`
}

type OPDSServerInputBody struct {
	Name     string  `json:"name" maxLength:"100"`
	URL      string  `json:"url" doc:"Address of the catalogue's root feed, such as http://nas:25600/opds/v1.2/catalog."`
	Username string  `json:"username,omitempty"`
	Password *string `json:"password,omitempty" doc:"Absent keeps the stored password; an empty string removes it."`
}

type OPDSServersOutput struct {
	Body struct {
		Servers []OPDSServerBody `json:"servers"`
	}
}

type OPDSServerOutput struct {
	Body struct {
		Server OPDSServerBody `json:"server"`
	}
}

type OPDSServerIDInput struct {
	ID int64 `path:"id"`
}

type CreateOPDSServerInput struct {
	Body OPDSServerInputBody
}

type UpdateOPDSServerInput struct {
	ID   int64 `path:"id"`
	Body OPDSServerInputBody
}

type CheckOPDSServerInput struct {
	Body struct {
		ServerID *int64  `json:"server_id,omitempty" doc:"A saved server, whose stored password is used when none is given."`
		URL      string  `json:"url"`
		Username string  `json:"username,omitempty"`
		Password *string `json:"password,omitempty"`
	}
}

type CheckOPDSServerOutput struct {
	Body struct {
		OK      bool   `json:"ok"`
		Problem string `json:"problem,omitempty" enum:"unauthorized,not_opds,unreachable,other_host" doc:"What is wrong, when something is."`
		Detail  string `json:"detail,omitempty"`
	}
}

type MangaSourceBody struct {
	ID   string `json:"id" example:"opds:3"`
	Name string `json:"name"`
	Kind string `json:"kind" enum:"opds,plugin"`
}

type MangaSourcesOutput struct {
	Body struct {
		Sources []MangaSourceBody `json:"sources"`
	}
}

type MangaSearchInput struct {
	Source   string `path:"source" example:"opds:3"`
	Query    string `query:"q" minLength:"1" maxLength:"200"`
	MediaRef string `query:"media_ref" doc:"The title being linked, so a source that knows it can put its series first."`
}

type MangaSeriesBody struct {
	ID      string `json:"id" doc:"The series' id in its source: a path on an OPDS server, a plugin's own id."`
	Title   string `json:"title"`
	Detail  string `json:"detail,omitempty" doc:"What tells similar names apart, such as a year."`
	Matched bool   `json:"matched" doc:"True when the source itself links this series to the title being linked."`
}

type MangaSearchOutput struct {
	Body struct {
		Series []MangaSeriesBody `json:"series"`
	}
}

type MangaTitleInput struct {
	MediaRef string `path:"mediaRef" example:"anilist:30002"`
}

type MangaLinkBody struct {
	Source      string `json:"source"`
	SourceName  string `json:"source_name"`
	SeriesID    string `json:"series_id"`
	SeriesTitle string `json:"series_title,omitempty"`
	ChosenBy    string `json:"chosen_by" enum:"auto,user"`
}

type MangaLinksOutput struct {
	Body struct {
		Links []MangaLinkBody `json:"links"`
	}
}

type PutMangaLinkInput struct {
	MediaRef string `path:"mediaRef"`
	Source   string `path:"source"`
	Body     struct {
		SeriesID    string `json:"series_id" doc:"As the search returned it."`
		SeriesTitle string `json:"series_title,omitempty"`
	}
}

type DeleteMangaLinkInput struct {
	MediaRef string `path:"mediaRef"`
	Source   string `path:"source"`
}

type MangaChapterBody struct {
	Ref         string   `json:"ref" doc:"Chapter reference for the reader's endpoints."`
	Source      string   `json:"source"`
	SourceName  string   `json:"source_name"`
	Number      string   `json:"number,omitempty" doc:"Chapter number as the source writes it. Absent for an unnumbered chapter."`
	Title       string   `json:"title"`
	Pages       int      `json:"pages"`
	Language    string   `json:"language,omitempty" doc:"Language of the translation, where the source says."`
	Groups      []string `json:"groups,omitempty" doc:"Who translated it. Shown next to the chapter: the source asks for the credit."`
	ExternalURL string   `json:"external_url,omitempty" doc:"The publisher's page, for a chapter the source only links to. It has no pages to read here."`
}

type MangaSourceProblemBody struct {
	Source     string `json:"source"`
	SourceName string `json:"source_name,omitempty"`
	Detail     string `json:"detail"`
}

type MangaChaptersOutput struct {
	Body struct {
		Chapters []MangaChapterBody       `json:"chapters"`
		Problems []MangaSourceProblemBody `json:"problems" doc:"Linked sources that could not be read this time; the others are listed."`
	}
}

func (h *Handler) Register(api huma.API) {
	h.registerServers(api)
	h.registerTitles(api)
	h.registerDownloads(api)
}

func (h *Handler) registerServers(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listOPDSServers",
		Method:      http.MethodGet,
		Path:        "/v1/manga/opds/servers",
		Summary:     "OPDS servers",
		Description: "The user's own catalogues: Komga, Kavita, Calibre-Web.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, _ *struct{}) (*OPDSServersOutput, error) {
		servers, err := h.svc.Servers(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &OPDSServersOutput{}
		out.Body.Servers = make([]OPDSServerBody, 0, len(servers))
		for _, server := range servers {
			out.Body.Servers = append(out.Body.Servers, serverBody(server))
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "createOPDSServer",
		Method:        http.MethodPost,
		Path:          "/v1/manga/opds/servers",
		Summary:       "Add an OPDS server",
		Description:   "Saves the server. The password is kept outside the database and never returned.",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *CreateOPDSServerInput) (*OPDSServerOutput, error) {
		server, err := h.svc.CreateServer(ctx, serverInput(in.Body))
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &OPDSServerOutput{}
		out.Body.Server = serverBody(*server)

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateOPDSServer",
		Method:      http.MethodPut,
		Path:        "/v1/manga/opds/servers/{id}",
		Summary:     "Change an OPDS server",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *UpdateOPDSServerInput) (*OPDSServerOutput, error) {
		server, err := h.svc.UpdateServer(ctx, in.ID, serverInput(in.Body))
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &OPDSServerOutput{}
		out.Body.Server = serverBody(*server)

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteOPDSServer",
		Method:        http.MethodDelete,
		Path:          "/v1/manga/opds/servers/{id}",
		Summary:       "Remove an OPDS server",
		Description:   "Removes the server, its password and every title's link to it.",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *OPDSServerIDInput) (*struct{}, error) {
		if err := h.svc.DeleteServer(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkOPDSServer",
		Method:      http.MethodPost,
		Path:        "/v1/manga/opds/check",
		Summary:     "Try an OPDS server",
		Description: "Reads the catalogue's root with the given credentials and says what is wrong, if anything. Answers 200 either way: a failed check is a result, not an error.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *CheckOPDSServerInput) (*CheckOPDSServerOutput, error) {
		result, err := h.svc.CheckServer(ctx, service.CheckInput{
			ServerID: in.Body.ServerID,
			URL:      in.Body.URL,
			Username: in.Body.Username,
			Password: in.Body.Password,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &CheckOPDSServerOutput{}
		out.Body.OK = result.OK
		out.Body.Problem = result.Problem
		out.Body.Detail = result.Detail

		return out, nil
	})
}

func (h *Handler) registerTitles(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listMangaSources",
		Method:      http.MethodGet,
		Path:        "/v1/manga/sources",
		Summary:     "Sources of chapters",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, _ *struct{}) (*MangaSourcesOutput, error) {
		sources, err := h.svc.Sources(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaSourcesOutput{}
		out.Body.Sources = make([]MangaSourceBody, 0, len(sources))
		for _, source := range sources {
			out.Body.Sources = append(out.Body.Sources, MangaSourceBody{ID: source.ID, Name: source.Name, Kind: source.Kind})
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchMangaSource",
		Method:      http.MethodGet,
		Path:        "/v1/manga/sources/{source}/search",
		Summary:     "Find a series in a source",
		Description: "For linking a title to the series that holds its chapters.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *MangaSearchInput) (*MangaSearchOutput, error) {
		hits, err := h.svc.Search(ctx, in.Source, in.Query, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaSearchOutput{}
		out.Body.Series = make([]MangaSeriesBody, 0, len(hits))
		for _, hit := range hits {
			out.Body.Series = append(out.Body.Series, MangaSeriesBody{ID: hit.ID, Title: hit.Title, Detail: hit.Detail, Matched: hit.Matched})
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listMangaLinks",
		Method:      http.MethodGet,
		Path:        "/v1/manga/titles/{mediaRef}/links",
		Summary:     "Series a title is read from",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *MangaTitleInput) (*MangaLinksOutput, error) {
		links, err := h.svc.Links(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaLinksOutput{}
		out.Body.Links = make([]MangaLinkBody, 0, len(links))
		for _, link := range links {
			out.Body.Links = append(out.Body.Links, MangaLinkBody{
				Source:      link.Source,
				SourceName:  link.SourceName,
				SeriesID:    link.SeriesID,
				SeriesTitle: link.SeriesTitle,
				ChosenBy:    link.ChosenBy,
			})
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "putMangaLink",
		Method:        http.MethodPut,
		Path:          "/v1/manga/titles/{mediaRef}/links/{source}",
		Summary:       "Read a title from a series",
		Description:   "Links the title to a series in the source, replacing any earlier link to the same source.",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *PutMangaLinkInput) (*struct{}, error) {
		if err := h.svc.SetLink(ctx, in.MediaRef, in.Source, in.Body.SeriesID, in.Body.SeriesTitle); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteMangaLink",
		Method:        http.MethodDelete,
		Path:          "/v1/manga/titles/{mediaRef}/links/{source}",
		Summary:       "Stop reading a title from a source",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *DeleteMangaLinkInput) (*struct{}, error) {
		if err := h.svc.DeleteLink(ctx, in.MediaRef, in.Source); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listMangaChapters",
		Method:      http.MethodGet,
		Path:        "/v1/manga/titles/{mediaRef}/chapters",
		Summary:     "Chapters of a title from its linked sources",
		Description: "Every chapter the linked series hold, in chapter order. Chapters in the library are listed by the library, not here.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *MangaTitleInput) (*MangaChaptersOutput, error) {
		chapters, problems, err := h.svc.Chapters(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaChaptersOutput{}
		out.Body.Chapters = make([]MangaChapterBody, 0, len(chapters))
		for i := range chapters {
			chapter := &chapters[i]
			out.Body.Chapters = append(out.Body.Chapters, MangaChapterBody{
				Ref:         chapter.Ref,
				Source:      chapter.Source,
				SourceName:  chapter.SourceName,
				Number:      chapter.Number,
				Title:       chapter.Title,
				Pages:       chapter.Pages,
				Language:    chapter.Language,
				Groups:      chapter.Groups,
				ExternalURL: chapter.ExternalURL,
			})
		}
		out.Body.Problems = make([]MangaSourceProblemBody, 0, len(problems))
		for _, problem := range problems {
			out.Body.Problems = append(out.Body.Problems, MangaSourceProblemBody(problem))
		}

		return out, nil
	})
}

func serverBody(server service.Server) OPDSServerBody {
	return OPDSServerBody{
		ID:          server.ID,
		Name:        server.Name,
		URL:         server.URL,
		Username:    server.Username,
		HasPassword: server.HasPassword,
	}
}

func serverInput(body OPDSServerInputBody) service.ServerInput {
	return service.ServerInput{
		Name:     body.Name,
		URL:      body.URL,
		Username: body.Username,
		Password: body.Password,
	}
}
