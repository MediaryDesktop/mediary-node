import { createRoute, Outlet } from '@tanstack/react-router'

import { DiscoverPage, isDiscoverTab } from '@pages/discover'
import type { DiscoverTab } from '@pages/discover'
import { DownloadsPage } from '@pages/downloads'
import { HomePage } from '@pages/home'
import { LibraryPage, ScanHistoryPage } from '@pages/library'
import { ListDetailPage, ListsPage } from '@pages/lists'
import { MediaPage } from '@pages/media'
import { SearchPage } from '@pages/search'
import { isSettingsSection, SettingsPage } from '@pages/settings'
import type { SettingsSection } from '@pages/settings'

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

// The tab lives in the address, so going back to Discover lands on the same one.
const discoverRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/discover',
	validateSearch: (search: Record<string, unknown>): { type?: DiscoverTab } =>
		isDiscoverTab(search.type) ? { type: search.type } : {},
	component: function DiscoverScreen() {
		const { type } = discoverRoute.useSearch()
		const navigate = discoverRoute.useNavigate()

		return (
			<DiscoverPage
				tab={type ?? 'anime'}
				onTabChange={tab => void navigate({ search: { type: tab }, replace: true })}
			/>
		)
	}
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

const scanHistoryRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/library/history',
	component: ScanHistoryPage
})

const downloadsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/downloads',
	component: DownloadsPage
})

const settingsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/settings',
	validateSearch: (search: Record<string, unknown>): { section?: SettingsSection } =>
		isSettingsSection(search.section) ? { section: search.section } : {},
	component: function SettingsScreen() {
		const { section } = settingsRoute.useSearch()
		return <SettingsPage section={section ?? 'app'} />
	}
})

export const framedTree = framedRoute.addChildren([
	homeRoute,
	discoverRoute,
	searchRoute,
	listsRoute,
	listDetailRoute,
	mediaRoute,
	libraryRoute,
	scanHistoryRoute,
	downloadsRoute,
	settingsRoute
])
