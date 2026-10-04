import { createRoute, useRouter } from '@tanstack/react-router'

import { ReadPage } from '@pages/read'

import { rootRoute } from './root'

// Outside the framed layout, like the player: a chapter owns the whole window.
export const readRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/read/$fileId',
	component: function ReadRoute() {
		const { fileId } = readRoute.useParams()
		const router = useRouter()

		return (
			<ReadPage
				key={fileId}
				fileId={Number(fileId)}
				onOpenChapter={next =>
					void router.navigate({ to: '/read/$fileId', params: { fileId: String(next) } })
				}
			/>
		)
	}
})
