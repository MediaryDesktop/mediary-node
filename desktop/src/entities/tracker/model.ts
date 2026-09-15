import { createQuery, keepFresh } from '@farfetched/core'
import { attach } from 'effector'

import { nodeTopic } from '@infra/node'

import { fetchTrackerEntriesFx } from './api'
import type { TrackerMediaType, TrackerTitle } from './api'

const trackerChanged = nodeTopic('tracker')

function createTrackerQuery(mediaType: TrackerMediaType) {
	const query = createQuery({
		effect: attach({ effect: fetchTrackerEntriesFx, mapParams: () => mediaType }),
		name: `tracker-${mediaType}`
	})

	keepFresh(query, {
		triggers: [trackerChanged.filter({ fn: event => event.payload?.media_type === mediaType })]
	})

	return query
}

export const trackerQueries = {
	anime: createTrackerQuery('anime'),
	manga: createTrackerQuery('manga')
} as const satisfies Record<TrackerMediaType, ReturnType<typeof createTrackerQuery>>

export function formatProgress(progress: number, total: number | null | undefined): string {
	return total ? `${progress} / ${total}` : String(progress)
}

export function preferredTitle(title: TrackerTitle): string {
	return title.user_preferred ?? title.english ?? title.romaji ?? title.native ?? ''
}
