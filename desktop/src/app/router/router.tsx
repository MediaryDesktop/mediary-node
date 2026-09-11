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
import { CatalogPage } from '@pages/catalog'
import { DiscoverPage } from '@pages/discover'
import { DownloadsPage } from '@pages/downloads'
import { NotFoundPage, RouteErrorPage } from '@pages/fallback'
import { HomePage } from '@pages/home'
import { LibraryPage } from '@pages/library'
import { ListsPage } from '@pages/lists'
import { SettingsPage } from '@pages/settings'
import { SetupPage } from '@pages/setup'

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

const discoverRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/discover',
	component: DiscoverPage
})

const catalogRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/catalog',
	component: CatalogPage
})

const listsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/lists',
	component: ListsPage
})

const libraryRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/library',
	component: LibraryPage
})

const downloadsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/downloads',
	component: DownloadsPage
})

const settingsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/settings',
	component: SettingsPage
})

const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/setup',
	component: SetupPage
})

const guestRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'guest',
	beforeLoad: async () => {
		const { account, linked } = await resolveSession()

		if (linked && account) {
			throw redirect({ to: landingRoute(account) })
		}
	}
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
	getParentRoute: () => rootRoute,
	path: '/verify-email',
	beforeLoad: async () => {
		const { account, linked } = await resolveSession()

		if (!account || !linked) {
			throw redirect({ to: '/sign-in' })
		}

		if (account.email_verified) {
			throw redirect({ to: '/' })
		}
	},
	component: VerifyEmailPage
})

const routeTree = rootRoute.addChildren([
	framedRoute.addChildren([
		homeRoute,
		discoverRoute,
		catalogRoute,
		listsRoute,
		libraryRoute,
		downloadsRoute,
		settingsRoute
	]),
	setupRoute,
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

export const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultNotFoundComponent: NotFoundPage,
	defaultErrorComponent: RouteErrorPage
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}
