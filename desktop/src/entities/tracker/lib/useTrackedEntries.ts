import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady } from '@infra/node'

import type { TrackerEntry } from '../api/api'
import { isLocalTrackerType, TRACKER_MEDIA_TYPES, trackerQueries } from '../model/model'

export function useTrackedEntries(enabled: boolean): TrackerEntry[] {
	const data = useUnit({
		anime: trackerQueries.anime.$data,
		manga: trackerQueries.manga.$data,
		movie: trackerQueries.movie.$data,
		series: trackerQueries.series.$data,
		dorama: trackerQueries.dorama.$data,
		book: trackerQueries.book.$data
	})

	const status = useUnit({
		anime: trackerQueries.anime.$status,
		manga: trackerQueries.manga.$status,
		movie: trackerQueries.movie.$status,
		series: trackerQueries.series.$status,
		dorama: trackerQueries.dorama.$status,
		book: trackerQueries.book.$status
	})

	const start = useUnit({
		anime: trackerQueries.anime.start,
		manga: trackerQueries.manga.start,
		movie: trackerQueries.movie.start,
		series: trackerQueries.series.start,
		dorama: trackerQueries.dorama.start,
		book: trackerQueries.book.start
	})

	const nodeReady = useUnit($nodeReady)

	useEffect(() => {
		if (!nodeReady) {
			return
		}

		for (const mediaType of TRACKER_MEDIA_TYPES) {
			if (status[mediaType] === 'initial' && (enabled || isLocalTrackerType(mediaType))) {
				start[mediaType]()
			}
		}
	}, [nodeReady, enabled, status, start])

	return useMemo(() => TRACKER_MEDIA_TYPES.flatMap(mediaType => data[mediaType]?.entries ?? []), [data])
}

export function useTrackedEntriesReady(enabled: boolean): boolean {
	const nodeReady = useUnit($nodeReady)
	const status = useUnit({
		anime: trackerQueries.anime.$status,
		manga: trackerQueries.manga.$status,
		movie: trackerQueries.movie.$status,
		series: trackerQueries.series.$status,
		dorama: trackerQueries.dorama.$status,
		book: trackerQueries.book.$status
	})

	return (
		nodeReady &&
		TRACKER_MEDIA_TYPES.every(mediaType => {
			if (!enabled && !isLocalTrackerType(mediaType)) {
				return true
			}

			return status[mediaType] !== 'initial' && status[mediaType] !== 'pending'
		})
	)
}

export function useTrackedEntry(mediaRef: string, enabled: boolean): TrackerEntry | null {
	const entries = useTrackedEntries(enabled)

	return useMemo(() => entries.find(entry => entry.media_ref === mediaRef) ?? null, [entries, mediaRef])
}
