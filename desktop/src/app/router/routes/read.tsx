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
				onOpenChapter={next => void router.navigate({ to: '/read/$ref', params: { ref: next } })}
			/>
		)
	}
})
