package service

import (
	"context"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The most downloads one listing returns; older ones stay in the table.
const listLimit = 200

type AddRequest struct {
	MediaRef string
	// Title names the folder the torrent is saved into.
	Title  string
	Magnet string
	// Torrent is a .torrent file's content, when there is no magnet.
	Torrent []byte
	// ReleaseID is a search result to download, in place of a magnet or a file.
	ReleaseID string
	// ChooseFiles holds the torrent in the client until the user picks its files.
	ChooseFiles bool
	// Episodes the download is for, when it is for some. With ChooseFiles, the
	// node itself picks their files once the torrent's file list arrives.
	Episodes []int
}

// TorrentLive is what the client last said about a torrent; absent when it has not been
// asked yet or could not be.
type TorrentLive struct {
	State    string  `json:"state" doc:"qBittorrent's own state name, e.g. downloading, stalledDL, pausedDL, uploading."`
	Paused   bool    `json:"paused"`
	Progress float64 `json:"progress" minimum:"0" maximum:"1"`
	Size     int64   `json:"size" doc:"Bytes the selected files take."`
	DLSpeed  int64   `json:"dl_speed" doc:"Bytes per second."`
	UPSpeed  int64   `json:"up_speed" doc:"Bytes per second."`
	Seeds    int     `json:"seeds"`
	Peers    int     `json:"peers"`
	ETA      *int64  `json:"eta,omitempty" doc:"Seconds left; absent when the client cannot tell."`
}

type TorrentDownload struct {
	ID          int64        `json:"id"`
	InfoHash    string       `json:"info_hash"`
	MediaRef    string       `json:"media_ref"`
	Title       string       `json:"title"`
	Name        string       `json:"name"`
	Source      string       `json:"source" enum:"magnet,file"`
	State       string       `json:"state" enum:"downloading,importing,done,failed" doc:"The node's state: a done download's files are in the library; the client may still be seeding it."`
	Choosing    bool         `json:"choosing" doc:"The client holds the torrent until its files are chosen."`
	Episodes    []int        `json:"episodes,omitempty" doc:"The episodes it was added for, when it was."`
	Imported    int          `json:"imported" doc:"Files that joined the library."`
	Error       string       `json:"error,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	CompletedAt *time.Time   `json:"completed_at,omitempty"`
	Live        *TorrentLive `json:"live,omitempty"`
}

// TorrentClientStatus says whether the downloads' live fields can be trusted.
type TorrentClientStatus struct {
	Configured bool   `json:"configured"`
	Kind       string `json:"kind" enum:",qbittorrent,embedded,torbox"`
	Reachable  bool   `json:"reachable"`
	Error      string `json:"error,omitempty"`
}

func (s *Service) Add(ctx context.Context, req AddRequest) (*TorrentDownload, error) {
	req.MediaRef = strings.TrimSpace(req.MediaRef)
	req.Title = strings.TrimSpace(req.Title)

	if req.MediaRef == "" {
		return nil, apperr.Invalid("media_ref", "a download has to be for a title")
	}
	given := 0
	for _, set := range []bool{req.Magnet != "", len(req.Torrent) > 0, req.ReleaseID != ""} {
		if set {
			given++
		}
	}
	if given != 1 {
		return nil, apperr.Invalid("magnet", "give one of a magnet link, a .torrent file or a search result")
	}

	if req.ReleaseID != "" {
		magnet, torrent, err := s.resolveRelease(ctx, req.ReleaseID)
		if err != nil {
			return nil, err
		}
		req.Magnet, req.Torrent = magnet, torrent
	}

	info, source, err := readTorrent(req)
	if err != nil {
		return nil, err
	}

	existing, err := s.store.ByHash(ctx, info.InfoHash)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read torrent downloads")
	}
	if existing != nil {
		return nil, apperr.New(apperr.KindConflict, "this torrent is already in the downloads")
	}

	client, err := s.requireClient(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := s.Settings(ctx)
	if err != nil {
		return nil, err
	}
	if settings.RootID == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "choose a library folder for downloads in the settings first")
	}

	rootPath, found, err := s.library.RootPath(ctx, settings.RootID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, apperr.New(apperr.KindPrecondition, "the download folder is no longer in the library; choose another")
	}

	title := req.Title
	if title == "" {
		title = info.Name
	}
	relDir := folderName(title)

	err = client.Add(ctx, qbittorrent.AddRequest{
		Magnet:   req.Magnet,
		Torrent:  req.Torrent,
		SavePath: savePath(filepath.Join(rootPath, relDir), settings),
		Category: torrentFolder,
		Tags:     []string{torrentTag},
		Hold:     req.ChooseFiles,
	})
	if err != nil {
		return nil, err
	}

	saved, err := s.store.Insert(ctx, store.NewDownload{
		InfoHash: info.InfoHash,
		MediaRef: req.MediaRef,
		Title:    title,
		RootID:   settings.RootID,
		RelDir:   relDir,
		Source:   source,
		Choosing: req.ChooseFiles,
		Episodes: req.Episodes,
	}, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the download")
	}

	if info.Name != "" {
		if err := s.store.SetName(ctx, saved.ID, info.Name, s.opts.Now()); err == nil {
			saved.Name = info.Name
		}
	}

	s.signal()
	s.publish("added", saved.ID)

	download := s.view(*saved)

	return &download, nil
}

func readTorrent(req AddRequest) (*metainfo.Info, string, error) {
	if req.Magnet != "" {
		info, err := metainfo.FromMagnet(req.Magnet)
		return info, store.SourceMagnet, err
	}

	info, err := metainfo.FromTorrent(req.Torrent)

	return info, store.SourceFile, err
}

// List returns the downloads, newest first, with what the client last said about
// each.
func (s *Service) List(ctx context.Context) ([]TorrentDownload, TorrentClientStatus, error) {
	rows, err := s.store.List(ctx, listLimit)
	if err != nil {
		return nil, TorrentClientStatus{}, apperr.Wrap(err, apperr.KindInternal, "list torrent downloads")
	}

	downloads := make([]TorrentDownload, 0, len(rows))
	for i := range rows {
		downloads = append(downloads, s.view(rows[i]))
	}

	conn, err := s.connection(ctx)
	if err != nil {
		return nil, TorrentClientStatus{}, err
	}

	s.mu.Lock()
	configured := conn.Kind == ClientEmbedded ||
		(conn.Kind == ClientQBittorrent && conn.URL != "") ||
		(conn.Kind == ClientTorBox && conn.APIKey != "")
	status := TorrentClientStatus{
		Configured: configured,
		Kind:       conn.Kind,
		Reachable:  configured && s.polled && s.clientError == "",
		Error:      s.clientError,
	}
	s.mu.Unlock()

	return downloads, status, nil
}

func (s *Service) view(row store.Download) TorrentDownload {
	download := TorrentDownload{
		ID:          row.ID,
		InfoHash:    row.InfoHash,
		MediaRef:    row.MediaRef,
		Title:       row.Title,
		Name:        row.Name,
		Source:      row.Source,
		State:       row.State,
		Choosing:    row.Choosing,
		Episodes:    row.Episodes,
		Imported:    row.Imported,
		Error:       row.Error,
		CreatedAt:   row.CreatedAt,
		CompletedAt: row.CompletedAt,
	}

	s.mu.Lock()
	torrent, ok := s.live[row.InfoHash]
	s.mu.Unlock()

	if ok {
		download.Live = liveOf(torrent)
	}

	return download
}

// qBittorrent's "infinite" ETA: 100 days.
const unknownETA = 8640000

func liveOf(t qbittorrent.Torrent) *TorrentLive {
	live := &TorrentLive{
		State:    t.State,
		Paused:   paused(t.State),
		Progress: t.Progress,
		Size:     t.Size,
		DLSpeed:  t.DLSpeed,
		UPSpeed:  t.UPSpeed,
		Seeds:    t.Seeds,
		Peers:    t.Peers,
	}

	if t.ETA > 0 && t.ETA < unknownETA {
		eta := t.ETA
		live.ETA = &eta
	}

	return live
}

// qBittorrent 4 says paused, 5 says stopped.
func paused(state string) bool {
	return strings.HasPrefix(state, "paused") || strings.HasPrefix(state, "stopped")
}

func (s *Service) Pause(ctx context.Context, id int64) error {
	return s.control(ctx, id, func(client Client, hash string) error { return client.Pause(ctx, hash) })
}

func (s *Service) Resume(ctx context.Context, id int64) error {
	return s.control(ctx, id, func(client Client, hash string) error { return client.Resume(ctx, hash) })
}

func (s *Service) control(ctx context.Context, id int64, act func(Client, string) error) error {
	download, err := s.find(ctx, id)
	if err != nil {
		return err
	}

	client, err := s.requireClient(ctx)
	if err != nil {
		return err
	}

	if err := act(client, download.InfoHash); err != nil {
		return err
	}

	s.signal()

	return nil
}

// Remove takes the torrent out of the client and the download off the list.
// Files already in the library stay there unless withFiles; the library notices
// deleted ones on its next scan.
func (s *Service) Remove(ctx context.Context, id int64, withFiles bool) error {
	download, err := s.find(ctx, id)
	if err != nil {
		return err
	}

	client, err := s.currentClient(ctx)
	if err != nil {
		return err
	}

	if client != nil {
		torrents, err := client.Torrents(ctx, []string{download.InfoHash})
		if err != nil {
			// Taking the row away while the client is out of reach would leave a
			// torrent the node no longer knows about, downloading for ever.
			return err
		}
		if len(torrents) > 0 {
			if err := client.Delete(ctx, download.InfoHash, withFiles); err != nil {
				return err
			}
		}
	}

	if _, err := s.store.Delete(ctx, id); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "delete the download")
	}

	s.mu.Lock()
	delete(s.live, download.InfoHash)
	s.mu.Unlock()

	s.publish("removed", id)

	return nil
}

func (s *Service) find(ctx context.Context, id int64) (*store.Download, error) {
	download, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the download")
	}
	if download == nil {
		return nil, apperr.New(apperr.KindNotFound, "download %d does not exist", id)
	}

	return download, nil
}

// relPath is a torrent file's path inside the library folder.
func relPath(download store.Download, file qbittorrent.File) string {
	return path.Join(download.RelDir, file.Name)
}
