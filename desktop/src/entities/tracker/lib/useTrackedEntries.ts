import { combine, createStore } from 'effector'
import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady, whenNodeReady } from '@infra/node'

import type { TrackerEntry } from '../api/api'
import type { TrackerMediaType } from '../api/api'
import { isLocalTrackerType, TRACKER_MEDIA_TYPES, trackerQueries } from '../model/model'

/**
 * Latches on once reached instead of tracking the current pending state, so a
 * background refetch (e.g. from `keepFresh` reacting to a node sync event right after
 * startup) doesn't flip `useTrackedEntriesReady` back to `false` and make the home page
 * blink back to its loading skeleton — farfetched queries keep their last successful
 * `$data` during a refetch, so there's nothing stale to hide while that happens.
 */
const $nodeEverReady = createStore(false).on($nodeReady, (everReady, ready) => everReady || ready)

const $everLoaded = combine(
	Object.fromEntries(
		TRACKER_MEDIA_TYPES.map(mediaType => [
			mediaType,
			createStore(false).on(
				trackerQueries[mediaType].$status,
				(loaded, status) => loaded || (status !== 'initial' && status !== 'pending')
			)
		])
	) as Record<TrackerMediaType, ReturnType<typeof createStore<boolean>>>
)

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

	const ask = useUnit({
		anime: whenNodeReady(trackerQueries.anime),
		manga: whenNodeReady(trackerQueries.manga),
		movie: whenNodeReady(trackerQueries.movie),
		series: whenNodeReady(trackerQueries.series),
		dorama: whenNodeReady(trackerQueries.dorama),
		book: whenNodeReady(trackerQueries.book)
	})

	useEffect(() => {
		for (const mediaType of TRACKER_MEDIA_TYPES) {
			if (status[mediaType] === 'initial' && (enabled || isLocalTrackerType(mediaType))) {
				ask[mediaType]()
			}
		}
	}, [enabled, status, ask])

	return useMemo(() => TRACKER_MEDIA_TYPES.flatMap(mediaType => data[mediaType]?.entries ?? []), [data])
}

export function useTrackedEntriesReady(enabled: boolean): boolean {
	const nodeEverReady = useUnit($nodeEverReady)
	const everLoaded = useUnit($everLoaded)

	return (
		nodeEverReady &&
		TRACKER_MEDIA_TYPES.every(mediaType => {
			if (!enabled && !isLocalTrackerType(mediaType)) {
				return true
			}

			return everLoaded[mediaType]
		})
	)
}

export function useTrackedEntry(mediaRef: string, enabled: boolean): TrackerEntry | null {
	const entries = useTrackedEntries(enabled)

	return useMemo(() => entries.find(entry => entry.media_ref === mediaRef) ?? null, [entries, mediaRef])
}
