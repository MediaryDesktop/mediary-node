import type { TorrentRelease, TorrentSearchResult } from '@entities/torrent'

export const ALL_SOURCES = 'all'

export interface ReleaseSourceOption {
	key: string
	name: string
	results: number
}

// A plugin and a Torznab source can share a name, so a source is told apart by
// what it is: the plugin's id, or the Torznab source's number.
export function releaseSourceKey(release: Pick<TorrentRelease, 'plugin' | 'source_id'>): string {
	return release.plugin ? `plugin:${release.plugin}` : `source:${release.source_id}`
}

export function sourceOptions(result: TorrentSearchResult | null | undefined): ReleaseSourceOption[] {
	return (result?.sources ?? [])
		.filter(source => source.results > 0)
		.map(source => ({
			key: releaseSourceKey({ plugin: source.plugin, source_id: source.id }),
			name: source.name,
			results: source.results
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
}

export function filterBySource(releases: readonly TorrentRelease[], source: string): TorrentRelease[] {
	if (source === ALL_SOURCES) {
		return [...releases]
	}

	return releases.filter(release => releaseSourceKey(release) === source)
}

export type EmptyReason = 'filtered' | 'episode' | 'nothing'

// Why the list came out empty, so the picker can say what to change. The node
// counts a source's results before it drops the releases that do not hold the
// episode, so found-but-none-shown means the episode filter took them all.
export function emptyReason(result: TorrentSearchResult, episode: number): EmptyReason {
	if ((result.releases ?? []).length > 0) {
		return 'filtered'
	}

	return episode > 0 && foundCount(result) > 0 ? 'episode' : 'nothing'
}

export function foundCount(result: TorrentSearchResult): number {
	return (result.sources ?? []).reduce((sum, source) => sum + source.results, 0)
}
