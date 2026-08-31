package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/app"
	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
)

var version = "0.0.0-dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	out := "api/openapi.yaml"
	if len(os.Args) > 1 {
		out = os.Args[1]
	}

	_, api := httpapi.New(httpapi.Options{
		Version: version,
		Logger:  zerolog.Nop(),
	})

	app.Register(api, app.Deps{
		Logger: zerolog.Nop(),
		Build:  httpapi.BuildInfo{Version: version},
	})

	var (
		document []byte
		err      error
	)

	if strings.HasSuffix(out, ".json") {
		document, err = api.OpenAPI().MarshalJSON()
	} else {
		document, err = api.OpenAPI().YAML()
	}
	if err != nil {
		return fmt.Errorf("render openapi document: %w", err)
	}

	if dir := filepath.Dir(out); dir != "." {
		if err := os.MkdirAll(dir, 0o750); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}

	if err := os.WriteFile(out, document, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", out, err)
	}

	fmt.Printf("wrote %s (%d bytes)\n", out, len(document))

	return nil
}
