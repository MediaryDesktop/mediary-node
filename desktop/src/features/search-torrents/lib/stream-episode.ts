import type { TorrentRelease } from '@entities/torrent'

export interface StreamEpisode {
	episode?: number
	season?: number
}

export interface ReleaseWatching {
	activeId: string | null
	busy: boolean
	onWatch: (release: TorrentRelease, episode: StreamEpisode) => void
	onCancel: () => void
}

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
