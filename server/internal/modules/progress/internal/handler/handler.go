package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MediaryDesktop/mediary-node/server/internal/httpapi"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type TitleInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587" doc:"The title's media reference."`
}

type TitleOutput struct {
	Body *service.TitleProgress
}

type EpisodeInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587" doc:"The title's media reference."`
	Episode  int    `path:"episode" minimum:"1" doc:"Episode number across seasons, as the user's list counts it."`
	Body     struct {
		Watched bool `json:"watched" doc:"Mark the episode watched, or forget that it was."`
	}
}

type EpisodeOutput struct {
	Body *service.EpisodeState
}

type ChapterInput struct {
	MediaRef string `path:"media_ref" example:"anilist:30002" doc:"The title's media reference."`
	Chapter  string `path:"chapter" minLength:"1" maxLength:"32" example:"12.5" doc:"Chapter number as the source writes it."`
	Body     struct {
		Read bool `json:"read" doc:"Mark the chapter read, or forget that it was."`
	}
}

type ChapterOutput struct {
	Body *service.ChapterState
}

type ContinueInput struct {
	Limit int `query:"limit" minimum:"0" maximum:"50" doc:"How many titles at most; 0 for the most there can be."`
}

type ContinueOutput struct {
	Body struct {
		Items []service.ContinueItem `json:"items" doc:"Episodes begun and not finished, latest first, one per title."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getTitleProgress",
		Method:      http.MethodGet,
		Path:        "/v1/progress/titles/{media_ref}",
		Summary:     "Episodes and chapters of a title the user is in",
		Description: "Every episode the user played or marked — where they stopped and whether they watched it through — and every chapter they opened or marked. A title the user never opened answers with both lists empty. The number on the user's list is the tracker's and is not here: an episode below it counts as watched even without a state of its own.",
		Tags:        []string{"progress"},
	}, func(ctx context.Context, in *TitleInput) (*TitleOutput, error) {
		title, err := h.svc.Title(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TitleOutput{Body: title}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setEpisodeWatched",
		Method:      http.MethodPut,
		Path:        "/v1/progress/titles/{media_ref}/episodes/{episode}",
		Summary:     "Mark an episode watched or not",
		Description: "The user's own mark. Unmarking forgets the episode's position as well. The number on the user's list does not move either way; that is changed on the tracker entry.",
		Tags:        []string{"progress"},
	}, func(ctx context.Context, in *EpisodeInput) (*EpisodeOutput, error) {
		state, err := h.svc.SetEpisodeWatched(ctx, in.MediaRef, in.Episode, in.Body.Watched)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &EpisodeOutput{Body: state}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setChapterRead",
		Method:      http.MethodPut,
		Path:        "/v1/progress/titles/{media_ref}/chapters/{chapter}",
		Summary:     "Mark a chapter read or not",
		Description: "The user's own mark. Unmarking forgets the page as well. The number on the user's list does not move either way; that is changed on the tracker entry.",
		Tags:        []string{"progress"},
	}, func(ctx context.Context, in *ChapterInput) (*ChapterOutput, error) {
		state, err := h.svc.SetChapterRead(ctx, in.MediaRef, in.Chapter, in.Body.Read)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ChapterOutput{Body: state}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listContinueWatching",
		Method:      http.MethodGet,
		Path:        "/v1/progress/continue",
		Summary:     "Episodes to continue",
		Description: "Episodes of matched titles the user began and did not finish, latest first, one per title. One stopped too near its start or its end to be worth returning to is left out.",
		Tags:        []string{"progress"},
	}, func(ctx context.Context, in *ContinueInput) (*ContinueOutput, error) {
		items, err := h.svc.Continue(ctx, in.Limit)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ContinueOutput{}
		out.Body.Items = items

		return out, nil
	})
}
