import { createRoute, Outlet } from '@tanstack/react-router'

import { DiscoverPage } from '@pages/discover'
import { DownloadsPage } from '@pages/downloads'
import { HomePage } from '@pages/home'
import { LibraryPage } from '@pages/library'
import { ListDetailPage, ListsPage } from '@pages/lists'
import { MediaPage } from '@pages/media'
import { SearchPage } from '@pages/search'
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

const searchRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/search',
	component: SearchPage
})

const listsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/lists',
	component: ListsPage
})

const listDetailRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/lists/$listId',
	component: function ListDetailRoute() {
		const { listId } = listDetailRoute.useParams()
		return <ListDetailPage key={listId} listId={listId} />
	}
})

const mediaRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/media/$mediaRef',
	component: function MediaRoute() {
		const { mediaRef } = mediaRoute.useParams()
		return <MediaPage key={mediaRef} mediaRef={mediaRef} />
	}
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
	searchRoute,
	listsRoute,
	listDetailRoute,
	mediaRoute,
	libraryRoute,
	downloadsRoute,
	settingsRoute
])
