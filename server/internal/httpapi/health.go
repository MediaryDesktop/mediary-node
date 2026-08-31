package httpapi

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type BuildInfo struct {
	Version string
	Commit  string
	Built   string
}

type HealthOutput struct {
	Body struct {
		Status  string `json:"status"  example:"ok"      doc:"Node status."`
		Version string `json:"version" example:"0.1.0"   doc:"Semantic version of the running build."`
		Commit  string `json:"commit"  example:"abc1234" doc:"Git commit the build came from."`
		Built   string `json:"built"   example:"2026-08-27T12:00:00Z" doc:"Build timestamp."`
		Linked  bool   `json:"linked"  doc:"True when the node is paired with a cloud account."`
	}
}

func RegisterHealth(api huma.API, info BuildInfo, linked bool) {
	huma.Register(api, huma.Operation{
		OperationID: "getNodeHealth",
		Method:      http.MethodGet,
		Path:        "/v1/health",
		Summary:     "Node health",
		Description: "Reports liveness, the running build and whether a cloud account is paired.",
		Tags:        []string{"health"},
	}, func(context.Context, *struct{}) (*HealthOutput, error) {
		out := &HealthOutput{}
		out.Body.Status = "ok"
		out.Body.Version = info.Version
		out.Body.Commit = info.Commit
		out.Body.Built = info.Built
		out.Body.Linked = linked
		return out, nil
	})
}
