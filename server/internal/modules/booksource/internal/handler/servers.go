package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/servers"
)

type BookOPDSServerBody struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url" doc:"Address of the catalogue's root feed."`
	Username    string `json:"username,omitempty"`
	HasPassword bool   `json:"has_password" doc:"Whether a password is stored. The password itself is never sent back."`
}

type BookOPDSServerInputBody struct {
	Name string `json:"name" maxLength:"100"`
	URL  string `json:"url" maxLength:"2000" doc:"Address of the catalogue's root feed: http://nas:8083/opds for Calibre-Web, https://standardebooks.org/feeds/opds for Standard Ebooks."`
	// Standard Ebooks signs a patron in by e-mail alone.
	Username string  `json:"username,omitempty" maxLength:"200" doc:"For Standard Ebooks, the e-mail of a Patrons Circle member, with no password."`
	Password *string `json:"password,omitempty" maxLength:"500" doc:"Absent keeps the stored password; an empty string removes it."`
}

type BookOPDSServersOutput struct {
	Body struct {
		Servers []BookOPDSServerBody `json:"servers"`
	}
}

type BookOPDSServerOutput struct {
	Body struct {
		Server BookOPDSServerBody `json:"server"`
	}
}

type BookOPDSServerIDInput struct {
	ID int64 `path:"id"`
}

type CreateBookOPDSServerInput struct {
	Body BookOPDSServerInputBody
}

type UpdateBookOPDSServerInput struct {
	ID   int64 `path:"id"`
	Body BookOPDSServerInputBody
}

type CheckBookOPDSServerInput struct {
	Body struct {
		ServerID *int64  `json:"server_id,omitempty" doc:"A saved server, whose stored password is used when none is given."`
		URL      string  `json:"url" maxLength:"2000"`
		Username string  `json:"username,omitempty" maxLength:"200"`
		Password *string `json:"password,omitempty" maxLength:"500"`
	}
}

type CheckBookOPDSServerOutput struct {
	Body struct {
		OK      bool   `json:"ok"`
		Problem string `json:"problem,omitempty" enum:"unauthorized,not_opds,no_search,unreachable,other_host" doc:"What is wrong, when something is. no_search: the catalogue is listed but cannot be searched, so it takes no part in finding books."`
		Detail  string `json:"detail,omitempty"`
	}
}

func (h *Handler) registerServers(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listBookOPDSServers",
		Method:      http.MethodGet,
		Path:        "/v1/books/opds/servers",
		Summary:     "OPDS servers of books",
		Description: "The user's own catalogues of books — Calibre-Web, Kavita — and Standard Ebooks for its patrons. Each is searched beside Project Gutenberg.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, _ *struct{}) (*BookOPDSServersOutput, error) {
		list, err := h.servers.List(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &BookOPDSServersOutput{}
		out.Body.Servers = make([]BookOPDSServerBody, 0, len(list))
		for _, server := range list {
			out.Body.Servers = append(out.Body.Servers, BookOPDSServerBody(server))
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "createBookOPDSServer",
		Method:        http.MethodPost,
		Path:          "/v1/books/opds/servers",
		Summary:       "Add an OPDS server of books",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *CreateBookOPDSServerInput) (*BookOPDSServerOutput, error) {
		server, err := h.servers.Create(ctx, serverInput(&in.Body))
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &BookOPDSServerOutput{}
		out.Body.Server = BookOPDSServerBody(*server)

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateBookOPDSServer",
		Method:      http.MethodPut,
		Path:        "/v1/books/opds/servers/{id}",
		Summary:     "Change an OPDS server of books",
		Tags:        []string{"books"},
	}, func(ctx context.Context, in *UpdateBookOPDSServerInput) (*BookOPDSServerOutput, error) {
		server, err := h.servers.Update(ctx, in.ID, serverInput(&in.Body))
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &BookOPDSServerOutput{}
		out.Body.Server = BookOPDSServerBody(*server)

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteBookOPDSServer",
		Method:        http.MethodDelete,
		Path:          "/v1/books/opds/servers/{id}",
		Summary:       "Remove an OPDS server of books",
		Description:   "Books saved from it stay in the library.",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *BookOPDSServerIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.servers.Delete(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkBookOPDSServer",
		Method:      http.MethodPost,
		Path:        "/v1/books/opds/check",
		Summary:     "Try an OPDS server of books",
		Description: "Reads the catalogue and runs a search in it, before or after the server is saved.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, in *CheckBookOPDSServerInput) (*CheckBookOPDSServerOutput, error) {
		result, err := h.servers.Check(ctx, servers.CheckInput{
			ServerID: in.Body.ServerID,
			URL:      in.Body.URL,
			Username: in.Body.Username,
			Password: in.Body.Password,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &CheckBookOPDSServerOutput{}
		out.Body.OK, out.Body.Problem, out.Body.Detail = result.OK, result.Problem, result.Detail

		return out, nil
	})
}

func serverInput(body *BookOPDSServerInputBody) servers.Input {
	return servers.Input{Name: body.Name, URL: body.URL, Username: body.Username, Password: body.Password}
}
