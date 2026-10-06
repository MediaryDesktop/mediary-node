package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type TorrentDownloadsOutput struct {
	Body struct {
		Downloads []service.TorrentDownload   `json:"downloads"`
		Client    service.TorrentClientStatus `json:"client"`
	}
}

type AddTorrentDownloadInput struct {
	Body struct {
		MediaRef string `json:"media_ref" minLength:"1" doc:"The title the download is for; its files are matched to it."`
		Title    string `json:"title,omitempty" maxLength:"500" doc:"The title's name, which names the folder the torrent is saved into."`
		Magnet   string `json:"magnet,omitempty" maxLength:"65536" doc:"A magnet link with a BitTorrent v1 hash. Give this or torrent."`
		Torrent  []byte `json:"torrent,omitempty" doc:"A .torrent file, base64-encoded. Give this or magnet."`
	}
}

type TorrentDownloadOutput struct {
	Body service.TorrentDownload
}

type TorrentDownloadIDInput struct {
	ID int64 `path:"id"`
}

type RemoveTorrentDownloadInput struct {
	ID        int64 `path:"id"`
	WithFiles bool  `query:"with_files" doc:"Also delete the downloaded files from disk."`
}

type TorrentSettingsOutput struct {
	Body service.TorrentSettings
}

type PutTorrentSettingsInput struct {
	Body struct {
		URL      string                 `json:"url" maxLength:"2048" doc:"qBittorrent WebUI address; empty disconnects."`
		Username string                 `json:"username" maxLength:"256"`
		Password *string                `json:"password,omitempty" maxLength:"1024" doc:"Left out keeps the saved password; empty removes it."`
		RootID   int64                  `json:"root_id" minimum:"0" doc:"Library folder torrents are saved into; 0 while none is chosen."`
		PathMap  service.TorrentPathMap `json:"path_map" doc:"How the client names the node's folders, when it runs in Docker or on another machine."`
	}
}

type CheckTorrentClientInput struct {
	Body struct {
		URL      string  `json:"url" minLength:"1" maxLength:"2048"`
		Username string  `json:"username" maxLength:"256"`
		Password *string `json:"password,omitempty" maxLength:"1024" doc:"Left out uses the saved password."`
	}
}

type TorrentCheckOutput struct {
	Body service.TorrentCheckResult
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listTorrentDownloads",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/downloads",
		Summary:     "Torrent downloads",
		Description: "Downloads the node added to the torrent client, newest first, each with what the client last said about it. Changes arrive on the torrent topic.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentDownloadsOutput, error) {
		downloads, status, err := h.svc.List(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentDownloadsOutput{}
		out.Body.Downloads = downloads
		out.Body.Client = status

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "addTorrentDownload",
		Method:        http.MethodPost,
		Path:          "/v1/torrent/downloads",
		Summary:       "TorrentDownload a torrent for a title",
		Description:   "Adds a magnet link or a .torrent file to the torrent client, saving into the title's folder inside the download folder. When it finishes, its videos join the library matched to the title, each with the episode its name gives.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusCreated,
		MaxBodyBytes:  metainfo.MaxTorrentBytes*4/3 + 64<<10,
	}, func(ctx context.Context, in *AddTorrentDownloadInput) (*TorrentDownloadOutput, error) {
		download, err := h.svc.Add(ctx, service.AddRequest{
			MediaRef: in.Body.MediaRef,
			Title:    in.Body.Title,
			Magnet:   in.Body.Magnet,
			Torrent:  in.Body.Torrent,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentDownloadOutput{Body: *download}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "pauseTorrentDownload",
		Method:        http.MethodPost,
		Path:          "/v1/torrent/downloads/{id}/pause",
		Summary:       "Pause a torrent download",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *TorrentDownloadIDInput) (*struct{}, error) {
		if err := h.svc.Pause(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "resumeTorrentDownload",
		Method:        http.MethodPost,
		Path:          "/v1/torrent/downloads/{id}/resume",
		Summary:       "Resume a torrent download",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *TorrentDownloadIDInput) (*struct{}, error) {
		if err := h.svc.Resume(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "removeTorrentDownload",
		Method:        http.MethodDelete,
		Path:          "/v1/torrent/downloads/{id}",
		Summary:       "Remove a torrent download",
		Description:   "Takes the torrent out of the client and the download off the list. Needs the client reachable, so no torrent is left running that the node no longer knows. Files already in the library stay there unless with_files.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *RemoveTorrentDownloadInput) (*struct{}, error) {
		if err := h.svc.Remove(ctx, in.ID, in.WithFiles); err != nil {
			return nil, httpapi.ToHTTP(err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getTorrentSettings",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/settings",
		Summary:     "Torrent client settings",
		Description: "The password is never returned; has_password says whether one is saved.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentSettingsOutput, error) {
		settings, err := h.svc.Settings(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentSettingsOutput{Body: *settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putTorrentSettings",
		Method:      http.MethodPut,
		Path:        "/v1/torrent/settings",
		Summary:     "Save torrent client settings",
		Description: "The password goes to the node's secrets file, not the database.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *PutTorrentSettingsInput) (*TorrentSettingsOutput, error) {
		settings, err := h.svc.UpdateSettings(ctx, service.TorrentSettingsUpdate{
			URL:      in.Body.URL,
			Username: in.Body.Username,
			Password: in.Body.Password,
			RootID:   in.Body.RootID,
			PathMap:  in.Body.PathMap,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentSettingsOutput{Body: *settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkTorrentClient",
		Method:      http.MethodPost,
		Path:        "/v1/torrent/check",
		Summary:     "Try a torrent client connection",
		Description: "Signs in to qBittorrent with the given address and credentials, saved or not, and reports its version.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *CheckTorrentClientInput) (*TorrentCheckOutput, error) {
		conn := service.Connection{URL: in.Body.URL, Username: in.Body.Username}
		if in.Body.Password != nil {
			conn.Password = *in.Body.Password
		}

		result, err := h.svc.Check(ctx, conn, in.Body.Password == nil)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentCheckOutput{Body: *result}, nil
	})
}
