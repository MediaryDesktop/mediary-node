import type { TFunction } from 'i18next'

import type { AddTorrentParams, TorrentRelease } from '@entities/torrent'

import { coveredEpisodes } from './episodes'

export type ReleaseKind = 'all' | 'episodes' | 'batches'

export interface ReleaseFilter {
	kind: ReleaseKind
	onlyMissing: boolean
	missing: readonly number[] | null
}

export function filterReleases(releases: TorrentRelease[], { kind, onlyMissing, missing }: ReleaseFilter) {
	return releases.filter(found => {
		if (kind === 'episodes' && found.batch) return false
		if (kind === 'batches' && !found.batch) return false
		if (onlyMissing && missing?.length && coveredEpisodes(found, missing).length === 0) return false
		return true
	})
}

export function releaseLabel(found: TorrentRelease, t: TFunction): string {
	const range = found.episodes
	const episodes = range
		? range.from === range.to
			? t('torrents.files.episode', { number: range.from })
			: t('torrents.search.episodes', { from: range.from, to: range.to })
		: null

	if (found.season) {
		return episodes
			? `${t('torrents.search.seasonNumber', { number: found.season })} · ${episodes}`
			: t('torrents.search.wholeSeason', { number: found.season })
	}

	return episodes ?? t('torrents.search.noEpisode')
}

export interface DownloadTarget {
	mediaRef: string
	title: string
	missing: readonly number[] | null
}

export function downloadRequests(
	chosen: TorrentRelease[],
	{ mediaRef, title, missing }: DownloadTarget
): AddTorrentParams[] {
	return chosen.map(found => {
		const covered = coveredEpisodes(found, missing)
		const single =
			found.episodes && found.episodes.from === found.episodes.to ? found.episodes.from : null

		return {
			media_ref: mediaRef,
			title,
			release_id: found.id,
			episodes: covered.length > 0 ? covered : single !== null ? [single] : undefined,
			choose_files: found.batch
		}
	})
}
