import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { AppLayout } from './layout/app-layout'
import { HomeScreen } from './screens/home/home-screen'

/**
 * Routes are the code-splitting boundary — no barrel re-exporting every
 * screen, since screens carry Effector side effects and can't be tree-shaken
 * (measured +90 kB First Load JS per route on the previous client). A screen
 * composing several modules (e.g. the title page) lives in `./screens`, not
 * inside any one module.
 */

const rootRoute = createRootRoute({
	component: () => (
		<AppLayout>
			<Outlet />
		</AppLayout>
	)
})

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomeScreen
})

const routeTree = rootRoute.addChildren([homeRoute])

/** Hash history, not browser history — the packaged app loads from file://,
 * where pushState paths resolve to nothing reloadable. */
export const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultPreload: 'intent'
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}
