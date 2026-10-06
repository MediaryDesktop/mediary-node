package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/torznab"
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
		MediaRef    string `json:"media_ref" minLength:"1" doc:"The title the download is for; its files are matched to it."`
		Title       string `json:"title,omitempty" maxLength:"500" doc:"The title's name, which names the folder the torrent is saved into."`
		Magnet      string `json:"magnet,omitempty" maxLength:"65536" doc:"A magnet link with a BitTorrent v1 hash. Give this or torrent."`
		Torrent     []byte `json:"torrent,omitempty" doc:"A .torrent file, base64-encoded. Give this or magnet."`
		ChooseFiles bool   `json:"choose_files,omitempty" doc:"Hold the torrent in the client until its files are chosen with PUT .../files."`
		ReleaseID   string `json:"release_id,omitempty" maxLength:"100" doc:"A search result to download. Give this, magnet or torrent."`
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

type TorrentFilesOutput struct {
	Body struct {
		Files []service.TorrentFile `json:"files" doc:"Empty until a magnet's metadata has arrived."`
	}
}

type SelectTorrentFilesInput struct {
	ID   int64 `path:"id"`
	Body struct {
		Selected []int `json:"selected" minItems:"1" maxItems:"10000" doc:"Indices of the files to download; every other file is skipped."`
	}
}

type TorrentSettingsOutput struct {
	Body service.TorrentSettings
}

type PutTorrentSettingsInput struct {
	Body struct {
		Client   string                 `json:"client" enum:",qbittorrent,embedded" doc:"The user's qBittorrent, the node's own client, or none."`
		URL      string                 `json:"url" maxLength:"2048" doc:"qBittorrent WebUI address; empty disconnects."`
		Username string                 `json:"username" maxLength:"256"`
		Password *string                `json:"password,omitempty" maxLength:"1024" doc:"Left out keeps the saved password; empty removes it."`
		RootID   int64                  `json:"root_id" minimum:"0" doc:"Library folder torrents are saved into; 0 while none is chosen."`
		PathMap  service.TorrentPathMap `json:"path_map" doc:"How the client names the node's folders, when it runs in Docker or on another machine."`
	}
}

type CheckTorrentClientInput struct {
	Body struct {
		Client   string  `json:"client,omitempty" enum:",qbittorrent,embedded" doc:"embedded checks the node's own client; anything else, qBittorrent at url."`
		URL      string  `json:"url,omitempty" maxLength:"2048"`
		Username string  `json:"username" maxLength:"256"`
		Password *string `json:"password,omitempty" maxLength:"1024" doc:"Left out uses the saved password."`
	}
}

type TorrentCheckOutput struct {
	Body service.TorrentCheckResult
}

func (h *Handler) Register(api huma.API) {
	h.registerSearch(api)
	h.registerRules(api)

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

			ChooseFiles: in.Body.ChooseFiles,
			ReleaseID:   in.Body.ReleaseID,
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
		OperationID: "listTorrentFiles",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/downloads/{id}/files",
		Summary:     "Files of a torrent",
		Description: "Every file in the torrent with the episode the library reads from its name, and whether the client downloads it.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *TorrentDownloadIDInput) (*TorrentFilesOutput, error) {
		files, err := h.svc.Files(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentFilesOutput{}
		out.Body.Files = files

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "selectTorrentFiles",
		Method:        http.MethodPut,
		Path:          "/v1/torrent/downloads/{id}/files",
		Summary:       "Choose which files to download",
		Description:   "The client downloads only these files. A torrent added with choose_files starts once the choice is made.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *SelectTorrentFilesInput) (*struct{}, error) {
		if err := h.svc.SelectFiles(ctx, in.ID, in.Body.Selected); err != nil {
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
			Client:   in.Body.Client,
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
		conn := service.Connection{Kind: in.Body.Client, URL: in.Body.URL, Username: in.Body.Username}
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

type TorrentSourcesOutput struct {
	Body struct {
		Sources []service.TorrentSource `json:"sources"`
	}
}

type TorrentSourceOutput struct {
	Body service.TorrentSource
}

type TorrentSourceBody struct {
	Name   string  `json:"name" minLength:"1" maxLength:"100" example:"Jackett"`
	URL    string  `json:"url" minLength:"1" maxLength:"2048" example:"http://localhost:9117/api/v2.0/indexers/all/results/torznab/" doc:"The Torznab feed address; a pasted query, the key with it, is dropped."`
	APIKey *string `json:"api_key,omitempty" maxLength:"256" doc:"Left out keeps the saved key; empty removes it."`
}

type CreateTorrentSourceInput struct {
	Body TorrentSourceBody
}

type UpdateTorrentSourceInput struct {
	ID   int64 `path:"id"`
	Body TorrentSourceBody
}

type TorrentSourceIDInput struct {
	ID int64 `path:"id"`
}

type CheckTorrentSourceInput struct {
	Body struct {
		SourceID int64   `json:"source_id,omitempty" doc:"A saved source whose key to use when api_key is left out."`
		URL      string  `json:"url" minLength:"1" maxLength:"2048"`
		APIKey   *string `json:"api_key,omitempty" maxLength:"256"`
	}
}

type TorrentSourceCheckOutput struct {
	Body torznab.TorrentSourceCaps
}

type SearchTorrentsInput struct {
	MediaRef string `query:"media_ref" doc:"The title searched for; its names are the queries unless q is given."`
	Episode  int    `query:"episode" minimum:"0" doc:"Only releases that hold this episode; 0 for any."`
	Query    string `query:"q" maxLength:"200" doc:"Search for this instead of the title's names."`
}

type SearchTorrentsOutput struct {
	Body service.TorrentSearchResult
}

type TorrentProfileOutput struct {
	Body service.TorrentProfile
}

type PutTorrentProfileInput struct {
	Body service.TorrentProfile
}

type TorrentRulesOutput struct {
	Body struct {
		Rules []service.TorrentRule `json:"rules"`
	}
}

type TorrentRuleMediaInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587"`
}

type TorrentRuleOutput struct {
	Body struct {
		Rule *service.TorrentRule `json:"rule" doc:"Null when the title has no rule."`
	}
}

type PutTorrentRuleInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587"`
	Body     struct {
		Title       string `json:"title" minLength:"1" maxLength:"500" doc:"The title's name; it names the folder downloads go into."`
		Query       string `json:"query,omitempty" maxLength:"200" doc:"Searched for instead of the title's names."`
		FromEpisode *int   `json:"from_episode,omitempty" minimum:"1" doc:"Left out starts after the last episode the library has."`
		Enabled     bool   `json:"enabled"`
	}
}

type CheckTorrentRuleInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587"`
	Preview  bool   `query:"preview" doc:"Only say what would be downloaded."`
}

type TorrentRuleCheckOutput struct {
	Body service.TorrentRuleCheck
}

func (h *Handler) registerRules(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listTorrentRules",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/rules",
		Summary:     "Auto-download rules",
		Description: "Titles whose new episodes the node downloads by itself. Every 30 minutes each enabled rule searches the sources for releases named after the title and adds the best release of every episode it is missing; an episode no single release holds comes from a batch, of which only the missing episodes' files are downloaded.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentRulesOutput, error) {
		rules, err := h.svc.Rules(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentRulesOutput{}
		out.Body.Rules = rules

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getTorrentRule",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/rules/{media_ref}",
		Summary:     "A title's auto-download rule",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *TorrentRuleMediaInput) (*TorrentRuleOutput, error) {
		rule, err := h.svc.Rule(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentRuleOutput{}
		out.Body.Rule = rule

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putTorrentRule",
		Method:      http.MethodPut,
		Path:        "/v1/torrent/rules/{media_ref}",
		Summary:     "Create or change a title's auto-download rule",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *PutTorrentRuleInput) (*TorrentRuleOutput, error) {
		rule, err := h.svc.PutRule(ctx, service.RuleInput{
			MediaRef:    in.MediaRef,
			Title:       in.Body.Title,
			Query:       in.Body.Query,
			FromEpisode: in.Body.FromEpisode,
			Enabled:     in.Body.Enabled,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentRuleOutput{}
		out.Body.Rule = rule

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteTorrentRule",
		Method:        http.MethodDelete,
		Path:          "/v1/torrent/rules/{media_ref}",
		Summary:       "Remove a title's auto-download rule",
		Description:   "Downloads the rule already added stay.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *TorrentRuleMediaInput) (*struct{}, error) {
		if err := h.svc.DeleteRule(ctx, in.MediaRef); err != nil {
			return nil, httpapi.ToHTTP(err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkTorrentRule",
		Method:      http.MethodPost,
		Path:        "/v1/torrent/rules/{media_ref}/check",
		Summary:     "Look for a title's missing episodes now",
		Description: "Runs the rule at once, enabled or not. With preview, nothing is added: the answer is what would be.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *CheckTorrentRuleInput) (*TorrentRuleCheckOutput, error) {
		check, err := h.svc.CheckRule(ctx, in.MediaRef, in.Preview)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentRuleCheckOutput{Body: *check}, nil
	})
}

func (h *Handler) registerSearch(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getTorrentProfile",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/profile",
		Summary:     "Release profile",
		Description: "What the user likes in a release. Search scores every result by it and marks the best.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentProfileOutput, error) {
		profile, err := h.svc.Profile(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentProfileOutput{Body: *profile}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putTorrentProfile",
		Method:      http.MethodPut,
		Path:        "/v1/torrent/profile",
		Summary:     "Save the release profile",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *PutTorrentProfileInput) (*TorrentProfileOutput, error) {
		profile, err := h.svc.SetProfile(ctx, in.Body)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentProfileOutput{Body: *profile}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listTorrentSources",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/sources",
		Summary:     "Release search sources",
		Description: "The user's Torznab endpoints — Jackett, Prowlarr. The node ships no indexers of its own.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentSourcesOutput, error) {
		sources, err := h.svc.Sources(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &TorrentSourcesOutput{}
		out.Body.Sources = sources

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "createTorrentSource",
		Method:        http.MethodPost,
		Path:          "/v1/torrent/sources",
		Summary:       "Add a release search source",
		Description:   "The API key goes to the node's secrets file, not the database.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *CreateTorrentSourceInput) (*TorrentSourceOutput, error) {
		source, err := h.svc.CreateSource(ctx, service.SourceInput{Name: in.Body.Name, URL: in.Body.URL, APIKey: in.Body.APIKey})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentSourceOutput{Body: *source}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateTorrentSource",
		Method:      http.MethodPut,
		Path:        "/v1/torrent/sources/{id}",
		Summary:     "Change a release search source",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *UpdateTorrentSourceInput) (*TorrentSourceOutput, error) {
		source, err := h.svc.UpdateSource(ctx, in.ID, service.SourceInput{Name: in.Body.Name, URL: in.Body.URL, APIKey: in.Body.APIKey})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentSourceOutput{Body: *source}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteTorrentSource",
		Method:        http.MethodDelete,
		Path:          "/v1/torrent/sources/{id}",
		Summary:       "Remove a release search source",
		Description:   "Forgets the source and its key.",
		Tags:          []string{"torrent"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *TorrentSourceIDInput) (*struct{}, error) {
		if err := h.svc.DeleteSource(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkTorrentSource",
		Method:      http.MethodPost,
		Path:        "/v1/torrent/sources/check",
		Summary:     "Try a release search source",
		Description: "Asks the endpoint for its capabilities, before or after it is saved.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *CheckTorrentSourceInput) (*TorrentSourceCheckOutput, error) {
		caps, err := h.svc.CheckSource(ctx, in.Body.SourceID, in.Body.URL, in.Body.APIKey)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentSourceCheckOutput{Body: *caps}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchTorrents",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/search",
		Summary:     "Search for releases",
		Description: "Asks every source for the title's names, or for q, merges what they find by info hash, and reads episodes, quality and group from each name. With an episode, releases that cannot hold it are left out and the rest come in order: the episode alone, batches that hold it, names without episodes. A source that fails is reported in sources, and the others still answer.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *SearchTorrentsInput) (*SearchTorrentsOutput, error) {
		result, err := h.svc.Search(ctx, service.SearchRequest{MediaRef: in.MediaRef, Episode: in.Episode, Query: in.Query})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &SearchTorrentsOutput{Body: *result}, nil
	})
}
