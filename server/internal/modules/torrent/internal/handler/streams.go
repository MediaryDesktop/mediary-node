package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
)

type StartTorrentStreamInput struct {
	Body struct {
		MediaRef  string `json:"media_ref" minLength:"1" doc:"The title the stream is for; the player marks its episode watched."`
		Title     string `json:"title,omitempty" maxLength:"500"`
		Magnet    string `json:"magnet,omitempty" maxLength:"65536" doc:"A magnet link with a BitTorrent v1 hash. Give this, torrent or release_id."`
		Torrent   []byte `json:"torrent,omitempty" doc:"A .torrent file, base64-encoded."`
		ReleaseID string `json:"release_id,omitempty" maxLength:"100" doc:"A search result to play."`
		Episode   *int   `json:"episode,omitempty" minimum:"0" doc:"Picks the file from a batch, and is what gets marked watched."`
		Season    *int   `json:"season,omitempty" minimum:"0" doc:"For a show numbered by season: the episode counts within it."`
	}
}

type TorrentStreamIDInput struct {
	ID int64 `path:"id" minimum:"1"`
}

type TorrentStreamOutput struct {
	Body service.TorrentStream
}

func (h *Handler) registerStreams(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "startTorrentStream",
		Method:      http.MethodPost,
		Path:        "/v1/torrent/streams",
		Summary:     "Play a torrent without downloading it",
		Description: "Needs a debrid service as the torrent client. Gives it the torrent, which is not added to the downloads, and reports how far the service is; ask GET .../streams/{id} until the state is ready, then play file_id like a library file. A torrent the service already holds is ready at once.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *StartTorrentStreamInput) (*TorrentStreamOutput, error) {
		stream, err := h.svc.StartStream(ctx, service.StreamRequest{
			MediaRef:  in.Body.MediaRef,
			Title:     in.Body.Title,
			Magnet:    in.Body.Magnet,
			Torrent:   in.Body.Torrent,
			ReleaseID: in.Body.ReleaseID,
			Episode:   in.Body.Episode,
			Season:    in.Body.Season,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentStreamOutput{Body: *stream}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getTorrentStream",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/streams/{id}",
		Summary:     "How far a stream is",
		Description: "Streams live in the node's memory: after a restart, start the stream again.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *TorrentStreamIDInput) (*TorrentStreamOutput, error) {
		stream, err := h.svc.StreamStatus(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentStreamOutput{Body: *stream}, nil
	})
}
