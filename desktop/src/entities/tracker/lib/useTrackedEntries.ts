import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import type { TrackerEntry } from '../api/api'
import { isLocalTrackerType, TRACKER_MEDIA_TYPES, trackerQueries } from '../model/model'

// `enabled` is whether the AniList account is connected, passed in rather than
// read: entities do not import each other, so the page that knows about the
// connection owns it. Movies and shows are the node's own and always load.
export function useTrackedEntries(enabled: boolean): TrackerEntry[] {
	const data = useUnit({
		anime: trackerQueries.anime.$data,
		manga: trackerQueries.manga.$data,
		movie: trackerQueries.movie.$data,
		series: trackerQueries.series.$data,
		dorama: trackerQueries.dorama.$data
	})

	const status = useUnit({
		anime: trackerQueries.anime.$status,
		manga: trackerQueries.manga.$status,
		movie: trackerQueries.movie.$status,
		series: trackerQueries.series.$status,
		dorama: trackerQueries.dorama.$status
	})

	const start = useUnit({
		anime: trackerQueries.anime.start,
		manga: trackerQueries.manga.start,
		movie: trackerQueries.movie.start,
		series: trackerQueries.series.start,
		dorama: trackerQueries.dorama.start
	})

	useEffect(() => {
		for (const mediaType of TRACKER_MEDIA_TYPES) {
			if (status[mediaType] === 'initial' && (enabled || isLocalTrackerType(mediaType))) {
				start[mediaType]()
			}
		}
	}, [enabled, status, start])

	return useMemo(() => TRACKER_MEDIA_TYPES.flatMap(mediaType => data[mediaType]?.entries ?? []), [data])
}

export function useTrackedEntry(mediaRef: string, enabled: boolean): TrackerEntry | null {
	const entries = useTrackedEntries(enabled)

	return useMemo(() => entries.find(entry => entry.media_ref === mediaRef) ?? null, [entries, mediaRef])
}
