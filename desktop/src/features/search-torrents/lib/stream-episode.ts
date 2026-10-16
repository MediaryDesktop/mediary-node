import type { TorrentRelease } from '@entities/torrent'

export interface StreamEpisode {
	episode?: number
	season?: number
}

// Watching a release without downloading it, as the page wires it in: this
// feature only offers the button, the stream itself belongs elsewhere.
export interface ReleaseWatching {
	// The release being readied, or null.
	activeId: string | null
	// Something is being readied; another cannot start until it plays or is cancelled.
	busy: boolean
	onWatch: (release: TorrentRelease, episode: StreamEpisode) => void
	onCancel: () => void
}

// Which episode a release plays: its own when it holds one, the one searched
// for when it is a batch. A batch with no episode searched has nothing to pick
// by, so it cannot be watched; a release without episodes is a film or the like,
// and the node plays its largest video.
export function streamEpisode(
	release: TorrentRelease,
	searched: { episode: string; season: string }
): StreamEpisode | null {
	const range = release.episodes
	const wanted = Number(searched.episode) || undefined
	const season = release.season ?? (Number(searched.season) || undefined)

	if (!range) {
		return { season }
	}
	if (range.from === range.to) {
		return { episode: range.from, season }
	}
	if (wanted !== undefined && wanted >= range.from && wanted <= range.to) {
		return { episode: wanted, season }
	}

	return null
}
