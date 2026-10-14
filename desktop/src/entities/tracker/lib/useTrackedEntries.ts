import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady } from '@infra/node'

import type { TrackerEntry } from '../api/api'
import { isLocalTrackerType, TRACKER_MEDIA_TYPES, trackerQueries } from '../model/model'

// `enabled` is whether the AniList account is connected, passed in rather than
// read: entities do not import each other, so the page that knows about the
// connection owns it. Movies, shows and books are the node's own and always load.
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

	// Started before the node is up, a query fails on the missing connection and,
	// no longer `initial`, is never asked again — the node's own types would stay
	// empty all session.
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

export function useTrackedEntry(mediaRef: string, enabled: boolean): TrackerEntry | null {
	const entries = useTrackedEntries(enabled)

	return useMemo(() => entries.find(entry => entry.media_ref === mediaRef) ?? null, [entries, mediaRef])
}
