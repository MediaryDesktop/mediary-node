import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady } from '@infra/node'

import { mediaEpisodesQuery } from '@entities/media'

import { indexEpisodes } from '@features/continue-watching'
import type { EpisodeIndex } from '@features/continue-watching'

export function useEpisodeMeta(mediaRef: string): { meta: EpisodeIndex; count: number | null } {
	const [data, load, nodeReady] = useUnit([mediaEpisodesQuery.$data, mediaEpisodesQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load(mediaRef)
		}
	}, [mediaRef, load, nodeReady])

	return useMemo(() => {
		const list = data?.episodes.media_ref === mediaRef ? data.episodes : null
		const episodes = list?.episodes ?? []

		return {
			meta: indexEpisodes(episodes),
			count: list?.total ?? (episodes.length > 0 ? episodes.length : null)
		}
	}, [data, mediaRef])
}
