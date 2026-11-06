package service

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// Every scan event names its root by the root's id, the same number the
// library's own records use; one phase once sent the folder's path instead.
func TestEveryScanEventNamesItsRootByID(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Sousou no Frieren", "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv"), "one")

	added := h.addRoot(t, root)

	stream, unsubscribe := h.hub.Subscribe(events.TopicLibraryScan)
	defer unsubscribe()

	if _, err := h.svc.StartScan(context.Background(), 0); err != nil {
		t.Fatalf("start scan: %v", err)
	}

	phases := map[string]bool{}
	deadline := time.After(20 * time.Second)

	for {
		select {
		case event := <-stream:
			phase, _ := event.Payload["phase"].(string)
			phases[phase] = true

			if id, present := event.Payload["root_id"]; present && id != added.ID {
				t.Errorf("%s event names root %v (%T), want id %d", phase, id, id, added.ID)
			}

			if phase != "finished" {
				continue
			}

			if !phases["probing"] {
				t.Errorf("no probing event was seen (phases %v): the test checked nothing", phases)
			}

			return
		case <-deadline:
			t.Fatal("scan did not finish")
		}
	}
}
