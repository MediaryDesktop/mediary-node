import { createRoute } from '@tanstack/react-router'

import { WatchPage } from '@pages/watch'

import { rootRoute } from './root'

// Outside the framed layout: the player owns the whole window.
export const watchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/watch/$fileId',
	component: function WatchRoute() {
		const { fileId } = watchRoute.useParams()
		return <WatchPage key={fileId} fileId={Number(fileId)} />
	}
})
