import { createRoute, Outlet } from '@tanstack/react-router'

import { isManualMediaType } from '@features/manual-media-form'
import type { ManualMediaType } from '@features/manual-media-form'

import { DiscoverPage, isDiscoverTab } from '@pages/discover'
import type { DiscoverTab } from '@pages/discover'
import { DownloadsPage } from '@pages/downloads'
import { ExtensionsPage, isExtensionsTab } from '@pages/extensions'
import type { ExtensionsTab } from '@pages/extensions'
import { HomePage } from '@pages/home'
import { LibraryPage, ScanHistoryPage } from '@pages/library'
import { ListDetailPage, ListsPage } from '@pages/lists'
import { MediaPage } from '@pages/media'
import { MediaFormPage } from '@pages/media-form'
import { SearchPage } from '@pages/search'
import { isSettingsSection, SettingsPage } from '@pages/settings'
import type { SettingsSection } from '@pages/settings'

import { AppLayout } from '../../layout/AppLayout'
import { redirectFirstLaunchToDiscover } from '../guards/first-launch.guard'

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
	beforeLoad: redirectFirstLaunchToDiscover,
	component: HomePage
})

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

const createManualMediaRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/media/new',
	validateSearch: (search: Record<string, unknown>): { type?: ManualMediaType; title?: string } => ({
		type: isManualMediaType(search.type) ? search.type : undefined,
		title: typeof search.title === 'string' ? search.title : undefined
	}),
	component: function CreateManualMediaScreen() {
		const { type, title } = createManualMediaRoute.useSearch()
		return <MediaFormPage mode='create' mediaType={type} title={title ?? ''} />
	}
})

const editManualMediaRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/media/$mediaRef/edit',
	component: function EditManualMediaRoute() {
		const { mediaRef } = editManualMediaRoute.useParams()
		return <MediaFormPage key={mediaRef} mode='edit' mediaRef={mediaRef} />
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

const extensionsRoute = createRoute({
	getParentRoute: () => framedRoute,
	path: '/extensions',
	validateSearch: (search: Record<string, unknown>): { tab?: ExtensionsTab } =>
		isExtensionsTab(search.tab) ? { tab: search.tab } : {},
	component: function ExtensionsScreen() {
		const { tab } = extensionsRoute.useSearch()
		const navigate = extensionsRoute.useNavigate()

		return (
			<ExtensionsPage
				tab={tab ?? 'installed'}
				onTabChange={next => void navigate({ search: { tab: next }, replace: true })}
			/>
		)
	}
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
	createManualMediaRoute,
	editManualMediaRoute,
	libraryRoute,
	scanHistoryRoute,
	downloadsRoute,
	extensionsRoute,
	settingsRoute
])
