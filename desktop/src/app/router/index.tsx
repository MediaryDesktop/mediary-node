import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { HomePage } from '@pages/home'
import { SignInPage } from '@pages/sign-in'
import { SignUpPage } from '@pages/sign-up'

import { AppLayout } from '../layout/AppLayout'

const rootRoute = createRootRoute({ component: Outlet })

const framedRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'framed',
	component: () => (
		<AppLayout>
			<Outlet />
		</AppLayout>
	)
})

const homeRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/',
	component: HomePage
})

const signInRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-in',
	component: SignInPage
})

const signUpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-up',
	component: SignUpPage
})

const routeTree = rootRoute.addChildren([framedRoute.addChildren([homeRoute]), signInRoute, signUpRoute])

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
