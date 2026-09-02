import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { HomePage } from '@pages/home'
import { NewPasswordPage } from '@pages/new-password'
import { ResetPasswordPage } from '@pages/reset-password'
import { SignInPage } from '@pages/sign-in'
import { SignInEmailPage } from '@pages/sign-in-email'
import { SignUpPage } from '@pages/sign-up'
import { SignUpEmailPage } from '@pages/sign-up-email'
import { VerifyEmailPage } from '@pages/verify-email'

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

/**
 * The auth routes are flat rather than nested: `/sign-in` is a screen in its
 * own right, not a shell around `/sign-in/email`, and giving it an `Outlet`
 * would mean rendering the provider buttons underneath the email form.
 */
const signInRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-in',
	component: SignInPage
})

const signInEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-in/email',
	component: SignInEmailPage
})

const signUpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-up',
	component: SignUpPage
})

const signUpEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/sign-up/email',
	component: SignUpEmailPage
})

const verifyEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/verify-email',
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
	// The address the code was mailed to. Kept in the URL so a reload on this
	// screen does not lose the half of the pair the user cannot retype.
	validateSearch: (search: Record<string, unknown>): { email: string } => ({
		email: typeof search.email === 'string' ? search.email : ''
	}),
	component: NewPasswordPage
})

const routeTree = rootRoute.addChildren([
	framedRoute.addChildren([homeRoute]),
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
