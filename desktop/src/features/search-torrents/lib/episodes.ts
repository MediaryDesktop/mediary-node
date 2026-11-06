import type { TorrentRelease } from '@entities/torrent'

export function missingEpisodes(released: number | null, have: Iterable<number>): number[] | null {
	if (!released || released < 1) {
		return null
	}

	const owned = new Set(have)
	const missing: number[] = []

	for (let episode = 1; episode <= released; episode++) {
		if (!owned.has(episode)) {
			missing.push(episode)
		}
	}

	return missing
}

export function coveredEpisodes(release: TorrentRelease, missing: readonly number[] | null): number[] {
	const range = release.episodes
	if (!range || !missing) {
		return []
	}

	return missing.filter(episode => episode >= range.from && episode <= range.to)
}

export function summarizeEpisodes(episodes: readonly number[], head = 5): string {
	if (episodes.length <= head + 1) {
		return episodes.join(', ')
	}

	return `${episodes.slice(0, head).join(', ')}, …, ${episodes[episodes.length - 1]}`
}
