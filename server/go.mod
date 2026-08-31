module github.com/mediaryorg/mediary-node/server

// github.com/mediaryorg/mediary-contracts/go is imported by
// internal/platform/cloud but is deliberately absent from `require`: the module
// is not published yet, and a require line pointing at a tag that does not
// exist makes every build fail — including the workspace build that currently
// works.
//
// Until `go/v0.1.0` is tagged, this module resolves through the go.work in the
// workspace root; `go work sync` then adds the require line on its own. A
// `replace` directive is not the answer either — it would be committed and
// would break the build for anyone without this exact directory layout.
//
// See mediary-contracts/docs/contracts-and-codegen.md §6.

go 1.27

require (
	github.com/caarlos0/env/v11 v11.4.1
	github.com/coder/websocket v1.8.15
	github.com/danielgtaylor/huma/v2 v2.39.1
	github.com/go-chi/chi/v5 v5.3.2
	github.com/go-chi/cors v1.2.2
	github.com/pressly/goose/v3 v3.27.3
	github.com/rs/zerolog v1.35.1
	golang.org/x/sync v0.22.0
	gopkg.in/natefinch/lumberjack.v2 v2.2.1
	modernc.org/sqlite v1.57.0
)

require (
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/mattn/go-colorable v0.1.15 // indirect
	github.com/mattn/go-isatty v0.0.24 // indirect
	github.com/mfridman/interpolate v0.0.2 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/sethvargo/go-retry v0.4.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	modernc.org/libc v1.74.4 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
)
