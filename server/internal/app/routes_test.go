package app

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
)

// Every module registers into one API, and two of them naming a schema the same
// way only shows when they meet: huma panics at startup. This is where they meet.
func TestEveryModuleRegistersTogether(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	_, api := humatest.New(t)

	shutdown := Register(ctx, api, Deps{Logger: zerolog.Nop(), DB: database, DataDir: dir})
	shutdown()
}
