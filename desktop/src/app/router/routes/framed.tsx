import { createRoute, Outlet } from '@tanstack/react-router'

import { CatalogPage } from '@pages/catalog'
import { DiscoverPage } from '@pages/discover'
import { DownloadsPage } from '@pages/downloads'
import { HomePage } from '@pages/home'
import { LibraryPage } from '@pages/library'
import { ListsPage } from '@pages/lists'
import { SettingsPage } from '@pages/settings'

import { AppLayout } from '../../layout/AppLayout'

import { rootRoute } from './root'

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

export const framedTree = framedRoute.addChildren([
	homeRoute,
	discoverRoute,
	catalogRoute,
	listsRoute,
	libraryRoute,
	downloadsRoute,
	settingsRoute
])
