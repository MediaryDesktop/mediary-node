package service

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const frierenMagnet = "magnet:?xt=urn:btih:3d686dbc956d6d31534b428c40f28999b6531640&dn=Frieren+S01"

const frierenHash = "3d686dbc956d6d31534b428c40f28999b6531640"

type fakeClient struct {
	mu          sync.Mutex
	unreachable bool
	added       []qbittorrent.AddRequest
	torrents    map[string]qbittorrent.Torrent
	files       map[string][]qbittorrent.File
	deleted     map[string]bool
	paused      []string
	resumed     []string
	priorities  map[string]map[int]int
}

func newFakeClient() *fakeClient {
	return &fakeClient{
		torrents:   map[string]qbittorrent.Torrent{},
		files:      map[string][]qbittorrent.File{},
		deleted:    map[string]bool{},
		priorities: map[string]map[int]int{},
	}
}

func (f *fakeClient) down() error {
	if f.unreachable {
		return apperr.New(apperr.KindUnavailable, "qBittorrent is not reachable")
	}
	return nil
}

func (f *fakeClient) Version(context.Context) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return "v5.0.2", f.down()
}

func (f *fakeClient) Add(_ context.Context, req qbittorrent.AddRequest) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.down(); err != nil {
		return err
	}
	f.added = append(f.added, req)
	return nil
}

func (f *fakeClient) Torrents(_ context.Context, hashes []string) ([]qbittorrent.Torrent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.down(); err != nil {
		return nil, err
	}

	var found []qbittorrent.Torrent
	for _, hash := range hashes {
		if torrent, ok := f.torrents[hash]; ok {
			found = append(found, torrent)
		}
	}

	return found, nil
}

func (f *fakeClient) Files(_ context.Context, hash string) ([]qbittorrent.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.files[hash], f.down()
}

func (f *fakeClient) Pause(_ context.Context, hash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.paused = append(f.paused, hash)
	return f.down()
}

func (f *fakeClient) Resume(_ context.Context, hash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resumed = append(f.resumed, hash)
	return f.down()
}

func (f *fakeClient) SetFilePriority(_ context.Context, hash string, indices []int, priority int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.down(); err != nil {
		return err
	}
	if f.priorities[hash] == nil {
		f.priorities[hash] = map[int]int{}
	}
	for _, index := range indices {
		f.priorities[hash][index] = priority
	}
	return nil
}

func (f *fakeClient) Delete(_ context.Context, hash string, withFiles bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.down(); err != nil {
		return err
	}
	f.deleted[hash] = withFiles
	delete(f.torrents, hash)
	return nil
}

func (f *fakeClient) set(torrent qbittorrent.Torrent, files ...qbittorrent.File) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.torrents[torrent.Hash] = torrent
	f.files[torrent.Hash] = files
}

type imported struct {
	relPath  string
	mediaRef string
}

type fakeLibrary struct {
	roots    map[int64]string
	episodes map[string][]int

	mu       sync.Mutex
	imported []imported
}

func (l *fakeLibrary) RootPath(_ context.Context, rootID int64) (path string, found bool, err error) {
	path, found = l.roots[rootID]
	return path, found, nil
}

func (l *fakeLibrary) ImportFile(_ context.Context, _ int64, relPath, mediaRef string, _ *int) (int64, error) {
	if !strings.HasSuffix(relPath, ".mkv") {
		return 0, apperr.New(apperr.KindPrecondition, "%s is not a file the library keeps", relPath)
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	l.imported = append(l.imported, imported{relPath: relPath, mediaRef: mediaRef})

	return int64(len(l.imported)), nil
}

func (l *fakeLibrary) Episodes(_ context.Context, mediaRef string) ([]int, error) {
	return l.episodes[mediaRef], nil
}

// NameEpisode reads "<anything> - NN.mkv" the way the library's parser would.
func (l *fakeLibrary) NameEpisode(relPath string) (video bool, episode *int) {
	if !strings.HasSuffix(relPath, ".mkv") {
		return false, nil
	}

	name := strings.TrimSuffix(relPath, ".mkv")
	if dash := strings.LastIndex(name, " - "); dash >= 0 {
		if number, err := strconv.Atoi(name[dash+3:]); err == nil {
			return true, &number
		}
	}

	return true, nil
}

type harness struct {
	svc     *Service
	client  *fakeClient
	library *fakeLibrary
	root    string
	conns   []Connection
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	h := &harness{client: newFakeClient(), root: filepath.Join(dir, "Anime")}
	h.library = &fakeLibrary{roots: map[int64]string{1: h.root}}

	h.svc = New(store.New(database), secrets.New(filepath.Join(dir, "torrent-secrets.json")), h.library, events.NewHub(64), zerolog.Nop(), Options{
		NewClient: func(conn Connection) (Client, error) {
			h.conns = append(h.conns, conn)
			return h.client, nil
		},
		Now: func() time.Time { return time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC) },
	})

	return h
}

func (h *harness) configure(t *testing.T) {
	t.Helper()

	password := "secret"
	_, err := h.svc.UpdateSettings(context.Background(), TorrentSettingsUpdate{
		URL:      "http://localhost:8080",
		Username: "admin",
		Password: &password,
		RootID:   1,
	})
	if err != nil {
		t.Fatalf("settings: %v", err)
	}
}

func (h *harness) add(t *testing.T) *TorrentDownload {
	t.Helper()

	download, err := h.svc.Add(context.Background(), AddRequest{
		MediaRef: "anilist:154587",
		Title:    "Sousou no Frieren",
		Magnet:   frierenMagnet,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	return download
}

// writeVideo puts a file where the client would have saved it.
func (h *harness) writeVideo(t *testing.T, rel string) {
	t.Helper()

	path := filepath.Join(h.root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("video"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func (h *harness) only(t *testing.T) TorrentDownload {
	t.Helper()

	downloads, _, err := h.svc.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(downloads) != 1 {
		t.Fatalf("downloads = %+v, want one", downloads)
	}

	return downloads[0]
}

func TestAddingNeedsAClientAndAFolder(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	_, err := h.svc.Add(ctx, AddRequest{MediaRef: "anilist:1", Magnet: frierenMagnet})
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("without a client: %v, want precondition", err)
	}

	if _, err = h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{URL: "http://localhost:8080"}); err != nil {
		t.Fatal(err)
	}

	_, err = h.svc.Add(ctx, AddRequest{MediaRef: "anilist:1", Magnet: frierenMagnet})
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("without a folder: %v, want precondition", err)
	}

	if len(h.client.added) != 0 {
		t.Fatalf("nothing may reach the client, got %+v", h.client.added)
	}
}

func TestAddSavesIntoTheTitlesFolder(t *testing.T) {
	h := newHarness(t)
	h.configure(t)

	download := h.add(t)

	if download.InfoHash != frierenHash || download.State != store.StateDownloading || download.Name != "Frieren S01" {
		t.Fatalf("download = %+v", download)
	}

	if len(h.client.added) != 1 {
		t.Fatalf("added = %+v", h.client.added)
	}

	added := h.client.added[0]
	if added.SavePath != filepath.Join(h.root, "Sousou no Frieren") || added.Magnet != frierenMagnet || added.Category != "mediary" {
		t.Fatalf("add request = %+v", added)
	}

	if last := h.conns[len(h.conns)-1]; last.Password != "secret" || last.Username != "admin" {
		t.Fatalf("the client must be built from the saved connection, got %+v", last)
	}

	_, err := h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet})
	if apperr.KindOf(err) != apperr.KindConflict {
		t.Fatalf("the same torrent twice: %v, want conflict", err)
	}
}

func TestProgressComesFromTheClient(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.add(t)

	h.client.set(qbittorrent.Torrent{Hash: frierenHash, Name: "[Group] Frieren", State: "downloading", Progress: 0.4, DLSpeed: 2048, Seeds: 12, ETA: 90})

	if !h.svc.Poll(context.Background()) {
		t.Fatal("a downloading torrent keeps the poller active")
	}

	download := h.only(t)
	if download.State != store.StateDownloading || download.Name != "[Group] Frieren" {
		t.Fatalf("download = %+v", download)
	}
	if download.Live == nil || download.Live.Progress != 0.4 || download.Live.Seeds != 12 || download.Live.ETA == nil || *download.Live.ETA != 90 {
		t.Fatalf("live = %+v", download.Live)
	}

	_, status, err := h.svc.List(context.Background())
	if err != nil || !status.Configured || !status.Reachable {
		t.Fatalf("status = %+v, %v", status, err)
	}
}

func TestAFinishedTorrentJoinsTheLibrary(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.add(t)

	h.writeVideo(t, "Sousou no Frieren/Frieren/Frieren - 01.mkv")
	h.writeVideo(t, "Sousou no Frieren/Frieren/Frieren - 02.mkv")
	h.writeVideo(t, "Sousou no Frieren/Frieren/Frieren - 01.ass")

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "stalledUP", Progress: 1},
		qbittorrent.File{Name: "Frieren/Frieren - 01.mkv", Progress: 1, Priority: 1},
		qbittorrent.File{Name: "Frieren/Frieren - 02.mkv", Progress: 1, Priority: 1},
		qbittorrent.File{Name: "Frieren/Frieren - 01.ass", Progress: 1, Priority: 1},
		qbittorrent.File{Name: "Frieren/Frieren - 03.mkv", Progress: 0, Priority: 0},
	)

	h.svc.Poll(context.Background())

	download := h.only(t)
	if download.State != store.StateDone || download.Imported != 2 || download.CompletedAt == nil {
		t.Fatalf("download = %+v", download)
	}

	want := []imported{
		{relPath: "Sousou no Frieren/Frieren/Frieren - 01.mkv", mediaRef: "anilist:154587"},
		{relPath: "Sousou no Frieren/Frieren/Frieren - 02.mkv", mediaRef: "anilist:154587"},
	}
	if len(h.library.imported) != len(want) {
		t.Fatalf("imported = %+v", h.library.imported)
	}
	for i := range want {
		if h.library.imported[i] != want[i] {
			t.Fatalf("imported = %+v, want %+v", h.library.imported, want)
		}
	}

	if h.svc.Poll(context.Background()) {
		t.Fatal("a done download is no longer followed")
	}
}

func TestATorrentStillBeingCheckedIsNotFinished(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.add(t)

	h.client.set(qbittorrent.Torrent{Hash: frierenHash, State: "checkingUP", Progress: 1})
	h.svc.Poll(context.Background())

	if download := h.only(t); download.State != store.StateDownloading {
		t.Fatalf("download = %+v", download)
	}
}

func TestFilesOutsideTheExpectedFolderPointAtThePathMapping(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.add(t)

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "uploading", Progress: 1},
		qbittorrent.File{Name: "Frieren - 01.mkv", Progress: 1, Priority: 1},
	)
	h.svc.Poll(context.Background())

	download := h.only(t)
	if download.State != store.StateFailed || !strings.Contains(download.Error, "path mapping") {
		t.Fatalf("download = %+v", download)
	}
}

func TestATorrentGoneFromTheClientFailsOnlyAfterSeveralPolls(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.add(t)

	for poll := 1; poll < missingPolls; poll++ {
		h.svc.Poll(context.Background())
		if download := h.only(t); download.State != store.StateDownloading {
			t.Fatalf("after %d empty answers: %+v", poll, download)
		}
	}

	h.svc.Poll(context.Background())

	if download := h.only(t); download.State != store.StateFailed {
		t.Fatalf("download = %+v, want failed", download)
	}
}

func TestAnUnreachableClientKeepsTheDownloads(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	download := h.add(t)

	h.client.unreachable = true

	for range missingPolls + 1 {
		h.svc.Poll(context.Background())
	}

	listed := h.only(t)
	if listed.State != store.StateDownloading {
		t.Fatalf("download = %+v", listed)
	}

	_, status, err := h.svc.List(context.Background())
	if err != nil || status.Reachable || status.Error != "qBittorrent is not reachable" {
		t.Fatalf("status = %+v, %v, want the message without its kind", status, err)
	}

	if err := h.svc.Remove(context.Background(), download.ID, false); apperr.KindOf(err) != apperr.KindUnavailable {
		t.Fatalf("remove while unreachable: %v, want unavailable", err)
	}
	h.only(t)
}

func TestRemoveTakesTheTorrentOutOfTheClient(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	download := h.add(t)

	h.client.set(qbittorrent.Torrent{Hash: frierenHash, State: "downloading", Progress: 0.1})

	if err := h.svc.Remove(context.Background(), download.ID, true); err != nil {
		t.Fatal(err)
	}

	if withFiles, ok := h.client.deleted[frierenHash]; !ok || !withFiles {
		t.Fatalf("deleted = %+v", h.client.deleted)
	}

	downloads, _, _ := h.svc.List(context.Background())
	if len(downloads) != 0 {
		t.Fatalf("downloads = %+v", downloads)
	}
}

func TestSettingsKeepThePasswordOutOfSight(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	ctx := context.Background()

	settings, err := h.svc.Settings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !settings.HasPassword || settings.URL != "http://localhost:8080" || settings.RootID != 1 {
		t.Fatalf("settings = %+v", settings)
	}

	// Saving without a password keeps the saved one.
	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{URL: "http://nas:8080", Username: "admin", RootID: 1}); err != nil {
		t.Fatal(err)
	}
	if settings, _ := h.svc.Settings(ctx); !settings.HasPassword {
		t.Fatal("the password must survive a save that leaves it out")
	}

	for name, update := range map[string]TorrentSettingsUpdate{
		"half a mapping":   {URL: "http://nas:8080", PathMap: TorrentPathMap{Client: "/downloads"}},
		"a missing folder": {URL: "http://nas:8080", RootID: 9},
		"not an http url":  {URL: "nas:8080"},
	} {
		if _, err := h.svc.UpdateSettings(ctx, update); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: %v, want invalid", name, err)
		}
	}
}

func TestTheEnvironmentsConnectionHoldsUntilOneIsSaved(t *testing.T) {
	h := newHarness(t)
	h.svc.opts.Defaults = Connection{URL: "http://qbittorrent:8080", Username: "env"}

	settings, err := h.svc.Settings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.URL != "http://qbittorrent:8080" || settings.Username != "env" {
		t.Fatalf("settings = %+v", settings)
	}
}

func TestChoosingFilesHoldsTheTorrentUntilTheChoice(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	ctx := context.Background()

	download, err := h.svc.Add(ctx, AddRequest{
		MediaRef:    "anilist:154587",
		Title:       "Sousou no Frieren",
		Magnet:      frierenMagnet,
		ChooseFiles: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !download.Choosing || !h.client.added[0].Hold {
		t.Fatalf("download = %+v, add = %+v; want it held", download, h.client.added[0])
	}

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "stoppedDL"},
		qbittorrent.File{Index: 0, Name: "Frieren/Frieren - 01.mkv", Priority: 1},
		qbittorrent.File{Index: 1, Name: "Frieren/Frieren - 02.mkv", Priority: 1},
		qbittorrent.File{Index: 2, Name: "Frieren/Frieren - 02.ass", Priority: 1},
	)

	files, err := h.svc.Files(ctx, download.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 3 || files[1].Episode == nil || *files[1].Episode != 2 || !files[1].Video || files[2].Video {
		t.Fatalf("files = %+v", files)
	}

	if err := h.svc.SelectFiles(ctx, download.ID, []int{1, 2}); err != nil {
		t.Fatal(err)
	}

	if got := h.client.priorities[frierenHash]; got[0] != qbittorrent.PrioritySkip || got[1] != qbittorrent.PriorityNormal || got[2] != qbittorrent.PriorityNormal {
		t.Fatalf("priorities = %v", got)
	}
	if len(h.client.resumed) != 1 {
		t.Fatalf("a held torrent starts once its files are chosen, resumed = %v", h.client.resumed)
	}
	if listed := h.only(t); listed.Choosing {
		t.Fatalf("download = %+v, want the choice made", listed)
	}

	// Choosing again later changes the files without starting anything.
	if err := h.svc.SelectFiles(ctx, download.ID, []int{0, 1}); err != nil {
		t.Fatal(err)
	}
	if len(h.client.resumed) != 1 {
		t.Fatalf("resumed = %v, want no second start", h.client.resumed)
	}
}

func TestAFileChoiceTheTorrentCannotTake(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	ctx := context.Background()
	download := h.add(t)

	if err := h.svc.SelectFiles(ctx, download.ID, []int{0}); apperr.KindOf(err) != apperr.KindConflict {
		t.Fatalf("before the file list arrives: %v, want conflict", err)
	}

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "downloading"},
		qbittorrent.File{Index: 0, Name: "Frieren - 01.mkv", Priority: 1},
	)

	for name, selected := range map[string][]int{"nothing": nil, "a file it does not have": {0, 7}} {
		if err := h.svc.SelectFiles(ctx, download.ID, selected); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: %v, want invalid", name, err)
		}
	}
}

func TestTheBuiltInClientSavesStraightIntoTheFolder(t *testing.T) {
	h := newHarness(t)
	builtin := newFakeClient()
	h.svc.opts.Embedded = builtin
	ctx := context.Background()

	_, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{
		Client:  ClientEmbedded,
		RootID:  1,
		PathMap: TorrentPathMap{Client: "/downloads", Node: h.root},
	})
	if err != nil {
		t.Fatal(err)
	}

	h.add(t)

	if len(builtin.added) != 1 || len(h.client.added) != 0 {
		t.Fatalf("built-in got %d, qBittorrent got %d", len(builtin.added), len(h.client.added))
	}
	if got := builtin.added[0].SavePath; got != filepath.Join(h.root, "Sousou no Frieren") {
		t.Fatalf("save path = %q, want the node's own folder: the mapping is qBittorrent's", got)
	}

	_, status, err := h.svc.List(ctx)
	if err != nil || !status.Configured || status.Kind != ClientEmbedded {
		t.Fatalf("status = %+v, %v", status, err)
	}

	check, err := h.svc.Check(ctx, Connection{Kind: ClientEmbedded}, false)
	if err != nil || check.Version == "" {
		t.Fatalf("check = %+v, %v", check, err)
	}

	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: "transmission"}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("an unknown client: %v, want invalid", err)
	}
}
