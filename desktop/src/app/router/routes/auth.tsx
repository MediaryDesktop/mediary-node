import { createRoute, Outlet, redirect } from '@tanstack/react-router'

import { AuthLayout } from '@features/auth'

import {
	AuthEmailPage,
	AuthProvidersPage,
	NewPasswordPage,
	ResetPasswordPage,
	VerifyEmailPage
} from '@pages/auth'

import { requireGuest, requireUnverifiedAccount } from '../guards/auth.guard'

import { rootRoute } from './root'

const authRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'auth',
	component: () => (
		<AuthLayout>
			<Outlet />
		</AuthLayout>
	)
})

const guestRoute = createRoute({
	getParentRoute: () => authRoute,
	id: 'guest',
	beforeLoad: requireGuest
})

const signInRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/sign-in',
	component: () => <AuthProvidersPage mode='signIn' />
})

const signInEmailRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/sign-in/email',
	component: () => <AuthEmailPage mode='signIn' />
})

const signUpRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/sign-up',
	component: () => <AuthProvidersPage mode='signUp' />
})

const signUpEmailRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/sign-up/email',
	component: () => <AuthEmailPage mode='signUp' />
})

const resetPasswordRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/reset-password',
	component: ResetPasswordPage
})

const newPasswordRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: '/new-password',
	validateSearch: (search: Record<string, unknown>): { email: string } => ({
		email: typeof search.email === 'string' ? search.email : ''
	}),
	beforeLoad: ({ search }) => {
		if (!search.email) {
			throw redirect({ to: '/reset-password' })
		}
	},
	component: () => <NewPasswordPage email={newPasswordRoute.useSearch().email} />
})

const verifyEmailRoute = createRoute({
	getParentRoute: () => authRoute,
	path: '/verify-email',
	beforeLoad: requireUnverifiedAccount,
	component: VerifyEmailPage
})

export const authTree = authRoute.addChildren([
	verifyEmailRoute,
	guestRoute.addChildren([
		signInRoute,
		signInEmailRoute,
		signUpRoute,
		signUpEmailRoute,
		resetPasswordRoute,
		newPasswordRoute
	])
])
