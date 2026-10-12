import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady } from '@infra/node'

import { mediaEpisodesQuery } from '@entities/media'

import { indexEpisodes } from '@features/continue-watching'
import type { EpisodeIndex } from '@features/continue-watching'

// What the sources know about each episode, by number. Empty until they answer,
// and for good when they know nothing: every part of the page has to read well
// from the files alone.
export function useEpisodeMeta(mediaRef: string): { meta: EpisodeIndex; count: number | null } {
	const [data, load, nodeReady] = useUnit([mediaEpisodesQuery.$data, mediaEpisodesQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load(mediaRef)
		}
	}, [mediaRef, load, nodeReady])

	return useMemo(() => {
		// Shared across title pages like the files query, so it may still hold the
		// previous title's list for a moment.
		const list = data?.episodes.media_ref === mediaRef ? data.episodes : null
		const episodes = list?.episodes ?? []

		return {
			meta: indexEpisodes(episodes),
			count: list?.total ?? (episodes.length > 0 ? episodes.length : null)
		}
	}, [data, mediaRef])
}
