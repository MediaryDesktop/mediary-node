import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { torrentSearchQuery, useTorrentSetup } from '@entities/torrent'

import type { SearchTarget } from '../model/model'

export interface SearchCriteria {
	query: string
	season: string
	episode: string
}

export type ReleaseSearch = ReturnType<typeof useReleaseSearch>

// The search both the download form and the stream picker run: what was typed,
// the answer, and a first search on the target as soon as there is a source.
export function useReleaseSearch(mediaRef: string, target: SearchTarget) {
	const setup = useTorrentSetup()

	const [result, error, pending, search] = useUnit([
		torrentSearchQuery.$data,
		torrentSearchQuery.$error,
		torrentSearchQuery.$pending,
		torrentSearchQuery.start
	])

	const [criteria, setCriteria] = useState<SearchCriteria>(() => ({
		query: '',
		season: target.season ? String(target.season) : '',
		episode: target.episode ? String(target.episode) : ''
	}))
	const run = (next: SearchCriteria = criteria) => {
		setCriteria(next)
		search({
			mediaRef,
			episode: Number(next.episode) || 0,
			season: Number(next.season) || 0,
			query: next.query
		})
	}

	useEffect(() => {
		if (setup.loaded && setup.hasSources) {
			search({ mediaRef, episode: target.episode ?? 0, season: target.season ?? 0, query: '' })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setup.loaded, setup.hasSources, mediaRef])

	const problem =
		error && 'body' in error ? (error.body as { detail?: string; status?: number } | null) : null

	return {
		setup,
		result,
		pending,
		criteria,
		setCriteria,
		run,
		problem: problem && problem.status !== 428 ? problem : null,
		failedSources: (result?.sources ?? []).filter(source => source.error)
	}
}
