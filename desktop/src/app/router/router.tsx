import { createHashHistory, createRouter } from '@tanstack/react-router'

import { NotFoundPage, RouteErrorPage } from '@pages/fallback'

import { authTree } from './routes/auth'
import { framedTree } from './routes/framed'
import { readRoute } from './routes/read'
import { rootRoute } from './routes/root'
import { setupRoute } from './routes/setup'
import { watchRoute } from './routes/watch'
import { authViewTransition } from './transitions/auth.transition'

const routeTree = rootRoute.addChildren([framedTree, setupRoute, watchRoute, readRoute, authTree])

export const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultViewTransition: authViewTransition,
	defaultNotFoundComponent: NotFoundPage,
	defaultErrorComponent: RouteErrorPage
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}
