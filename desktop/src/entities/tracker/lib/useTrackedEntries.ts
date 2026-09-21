import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import type { TrackerEntry } from '../api/api'
import { trackerQueries } from '../model/model'

// `enabled` is passed in rather than read from the AniList account: entities do
// not import each other, so the page that knows about the connection owns it.
export function useTrackedEntries(enabled: boolean): TrackerEntry[] {
	const { anime, manga, animeStatus, mangaStatus, startAnime, startManga } = useUnit({
		anime: trackerQueries.anime.$data,
		manga: trackerQueries.manga.$data,
		animeStatus: trackerQueries.anime.$status,
		mangaStatus: trackerQueries.manga.$status,
		startAnime: trackerQueries.anime.start,
		startManga: trackerQueries.manga.start
	})

	useEffect(() => {
		if (!enabled) {
			return
		}

		if (animeStatus === 'initial') {
			startAnime()
		}

		if (mangaStatus === 'initial') {
			startManga()
		}
	}, [enabled, animeStatus, mangaStatus, startAnime, startManga])

	return useMemo(() => [...(anime?.entries ?? []), ...(manga?.entries ?? [])], [anime, manga])
}

export function useTrackedEntry(mediaRef: string, enabled: boolean): TrackerEntry | null {
	const entries = useTrackedEntries(enabled)

	return useMemo(() => entries.find(entry => entry.media_ref === mediaRef) ?? null, [entries, mediaRef])
}
