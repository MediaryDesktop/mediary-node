import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { fileTitle, libraryCollectionQuery } from '@entities/library-item'
import { $playerMode, playbackModel, playerOpened } from '@entities/playback'
import type { TrackerEntry } from '@entities/tracker'

import { $items, $loading, candidatesChanged } from '../model/model'
import type { Candidate, UpNextItem } from '../model/model'

import { episodeNumber, episodeSeason } from './episodes'

const VIDEO_TYPES = new Set(['anime', 'movie', 'series', 'dorama'])
const WATCHING = new Set(['CURRENT', 'REPEATING'])

// More than a row or two of "continue" is a list, not a shortcut.
const MAX_TITLES = 12

export interface UpNextEntry extends UpNextItem {
	entry: TrackerEntry
}

export interface ContinueWatchingState {
	items: UpNextEntry[]
	byRef: Map<string, UpNextEntry>
	// The titles are known but their files are not yet.
	loading: boolean
	pending: number
}

// The next episode of each title the user is watching, when the library already
// has its file. Titles without one are the tracker's "in progress", not this.
export function useContinueWatching(entries: TrackerEntry[]): ContinueWatchingState {
	const [collection, loadCollection, nodeReady, items, loading, changed] = useUnit([
		libraryCollectionQuery.$data,
		libraryCollectionQuery.start,
		$nodeReady,
		$items,
		$loading,
		candidatesChanged
	])

	useEffect(() => {
		if (nodeReady) {
			loadCollection()
		}
	}, [nodeReady, loadCollection])

	const byEntry = useMemo(() => new Map(entries.map(entry => [entry.media_ref, entry])), [entries])

	const candidates = useMemo((): Candidate[] => {
		const held = new Map(
			(collection?.collection.entries ?? []).map(entry => [
				entry.media_ref,
				entry.file_count - entry.missing_count
			])
		)

		return [...byEntry.values()]
			.filter(entry => WATCHING.has(entry.status) && VIDEO_TYPES.has(entry.media_type))
			.filter(entry => (held.get(entry.media_ref) ?? 0) > 0)
			.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
			.slice(0, MAX_TITLES)
			.map(entry => ({ mediaRef: entry.media_ref, progress: entry.progress }))
	}, [byEntry, collection])

	// A new file in the library changes the counts, not the candidates; both have
	// to reload what is next.
	const key = useMemo(() => {
		const counts = new Map(
			(collection?.collection.entries ?? []).map(entry => [entry.media_ref, entry.file_count])
		)

		return candidates
			.map(
				candidate =>
					`${candidate.mediaRef}:${candidate.progress}:${counts.get(candidate.mediaRef) ?? 0}`
			)
			.join('|')
	}, [candidates, collection])

	useEffect(() => {
		changed(candidates)
		// The key says when the candidates differ; their array is new on every refetch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, changed])

	return useMemo(() => {
		const shown = items.flatMap(item => {
			const entry = byEntry.get(item.mediaRef)
			return entry ? [{ ...item, entry }] : []
		})

		return {
			items: shown,
			byRef: new Map(shown.map(item => [item.mediaRef, item])),
			loading: loading && candidates.length > 0,
			pending: candidates.length
		}
	}, [items, byEntry, loading, candidates.length])
}

// Plays a library file in whichever player the user chose, and says so when the
// node cannot start it.
export function usePlayFile(): { play: (fileId: number) => void; starting: boolean } {
	const { t } = useTranslation()

	const [playExternally, starting, playerMode, openPlayer] = useUnit([
		playbackModel.playRequested,
		playbackModel.$starting,
		$playerMode,
		playerOpened
	])

	useUnitWatch(playbackModel.playFailed, ({ error }) =>
		toast.error(problemDetail(error, t('playback.failed')), { id: 'playback-failed' })
	)

	return {
		play: fileId => (playerMode === 'external' ? playExternally(fileId) : openPlayer(fileId)),
		starting
	}
}

// "Episode 5", "Season 2 · Episode 5", or a movie's own name.
export function useUpNextLabel(): (item: UpNextItem) => string {
	const { t } = useTranslation()

	return item => {
		const number = episodeNumber(item.file)

		if (number === null) {
			return fileTitle(item.file)
		}

		return item.seasonal
			? String(t('media.library.seasonEpisode', { season: episodeSeason(item.file) ?? 1, number }))
			: String(t('media.library.episode', { number }))
	}
}
