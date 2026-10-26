import { createRoute, useRouter } from '@tanstack/react-router'

import { routeRef } from '@entities/reader'

import { ReadPage } from '@pages/read'

import { rootRoute } from './root'

// Outside the framed layout, like the player: a chapter owns the whole window.
export const readRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/read/$ref',
	component: function ReadRoute() {
		const { ref } = readRoute.useParams()
		const router = useRouter()
		const chapterRef = routeRef(ref)

		return (
			<ReadPage
				key={chapterRef}
				chapterRef={chapterRef}
				// Replaces, not pushes: turning ten pages and leaving should take one
				// "back", not ten — to wherever the reader was opened from.
				onOpenChapter={next =>
					void router.navigate({ to: '/read/$ref', params: { ref: next }, replace: true })
				}
			/>
		)
	}
})
