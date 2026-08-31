package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mediaryorg/mediary-node/server/internal/app"
	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
)

var (
	version = "0.0.0-dev"
	commit  = "unknown"
	built   = "unknown"
)

func main() {
	err := app.Run(context.Background(), httpapi.BuildInfo{
		Version: version,
		Commit:  commit,
		Built:   built,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}
