import { IoLaptopOutline, IoLibraryOutline } from 'react-icons/io5'

import type { IconLike } from '@shared/ui'

// The settings sections, in the order the menu lists them. The id is what the
// address carries, so a notice elsewhere can open the section it is about.
export const SETTINGS_SECTIONS = [
	'app',
	'backup',
	'devices',
	'library',
	'player',
	'tmdb',
	'google-books',
	'torrent-client',
	'debrid',
	'torrent-search',
	'torrent-preferences',
	'manga-sources',
	'mangadex',
	'manga-downloads'
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export function isSettingsSection(value: unknown): value is SettingsSection {
	return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export interface SectionInfo {
	id: SettingsSection
	icon: IconLike
	// The section's keys under settings.sections.
	key:
		| 'app'
		| 'backup'
		| 'devices'
		| 'library'
		| 'player'
		| 'tmdb'
		| 'googleBooks'
		| 'torrentClient'
		| 'debrid'
		| 'torrentSearch'
		| 'torrentPreferences'
		| 'mangaSources'
		| 'mangaDex'
		| 'mangaDownloads'
}

// The menu's cards: what belongs together sits in one, as in Seanime.
export const SECTION_GROUPS: readonly (readonly SectionInfo[])[] = [
	[{ id: 'app', icon: 'common/settings', key: 'app' }],
	[
		{ id: 'backup', icon: 'common/cloud', key: 'backup' },
		{ id: 'devices', icon: <IoLaptopOutline size={18} />, key: 'devices' }
	],
	[
		{ id: 'library', icon: <IoLibraryOutline size={18} />, key: 'library' },
		{ id: 'player', icon: 'common/player', key: 'player' }
	],
	[
		{ id: 'tmdb', icon: 'categories/movie', key: 'tmdb' },
		{ id: 'google-books', icon: 'categories/book', key: 'googleBooks' }
	],
	[
		{ id: 'torrent-client', icon: 'common/download', key: 'torrentClient' },
		{ id: 'debrid', icon: 'common/play', key: 'debrid' },
		{ id: 'torrent-search', icon: 'common/search', key: 'torrentSearch' },
		{ id: 'torrent-preferences', icon: 'common/star', key: 'torrentPreferences' }
	],
	[
		{ id: 'manga-sources', icon: 'common/database', key: 'mangaSources' },
		{ id: 'mangadex', icon: 'common/book-open', key: 'mangaDex' },
		{ id: 'manga-downloads', icon: 'common/folder', key: 'mangaDownloads' }
	]
]
