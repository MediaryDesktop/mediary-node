import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect
} from '@tanstack/react-router'

import { landingRoute, resolveSession } from '@entities/session'

import {
	AuthEmailPage,
	AuthProvidersPage,
	NewPasswordPage,
	ResetPasswordPage,
	VerifyEmailPage
} from '@pages/auth'
import { HomePage } from '@pages/home'
import { SetupPage } from '@pages/setup'

import { AppLayout } from '../layout/AppLayout'

async function requireLiveSession() {
	const { account, linked } = await resolveSession()

	if (!account || !linked) {
		throw redirect({ to: '/sign-in' })
	}

	if (account.email_verified) {
		throw redirect({ to: '/' })
	}
}

async function requireNoLiveSession() {
	const { account, linked } = await resolveSession()

	if (linked && account) {
		throw redirect({ to: landingRoute(account) })
	}
}

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

const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/setup',
	component: SetupPage
})

const signInRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-in',
	beforeLoad: requireNoLiveSession,
	component: () => <AuthProvidersPage mode='signIn' />
})

const signInEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-in/email',
	beforeLoad: requireNoLiveSession,
	component: () => <AuthEmailPage mode='signIn' />
})

const signUpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-up',
	beforeLoad: requireNoLiveSession,
	component: () => <AuthProvidersPage mode='signUp' />
})

const signUpEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-up/email',
	beforeLoad: requireNoLiveSession,
	component: () => <AuthEmailPage mode='signUp' />
})

const verifyEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/verify-email',
	beforeLoad: requireLiveSession,
	component: VerifyEmailPage
})

const resetPasswordRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/reset-password',
	component: ResetPasswordPage
})

const newPasswordRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/new-password',

	validateSearch: (search: Record<string, unknown>): { email: string } => ({
		email: typeof search.email === 'string' ? search.email : ''
	}),
	component: NewPasswordPage
})

const routeTree = rootRoute.addChildren([
	framedRoute.addChildren([homeRoute]),
	setupRoute,
	signInRoute,
	signInEmailRoute,
	signUpRoute,
	signUpEmailRoute,
	verifyEmailRoute,
	resetPasswordRoute,
	newPasswordRoute
])

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
