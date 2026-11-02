import { IoLaptopOutline, IoLibraryOutline } from 'react-icons/io5'

import type { IconLike } from '@shared/ui'

// The settings sections, in the order the menu lists them. The id is what the
// address carries, so a notice elsewhere can open the section it is about.
export const SETTINGS_SECTIONS = [
	'app',
	'anilist',
	'backup',
	'devices',
	'library',
	'player',
	'tmdb',
	'google-books',
	'manual-media',
	'torrent-client',
	'debrid',
	'torrent-search',
	'torrent-preferences',
	'manga-sources',
	'manga-downloads',
	'book-sources',
	'book-downloads'
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
		| 'anilist'
		| 'backup'
		| 'devices'
		| 'library'
		| 'player'
		| 'tmdb'
		| 'googleBooks'
		| 'manualMedia'
		| 'torrentClient'
		| 'debrid'
		| 'torrentSearch'
		| 'torrentPreferences'
		| 'mangaSources'
		| 'mangaDownloads'
		| 'bookSources'
		| 'bookDownloads'
}

// The menu's cards: what belongs together sits in one, as in Seanime.
export const SECTION_GROUPS: readonly (readonly SectionInfo[])[] = [
	[{ id: 'app', icon: 'common/settings', key: 'app' }],
	[{ id: 'anilist', icon: 'common/anilist', key: 'anilist' }],
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
	[{ id: 'manual-media', icon: 'common/wand-sparkles', key: 'manualMedia' }],
	[
		{ id: 'torrent-client', icon: 'common/download', key: 'torrentClient' },
		{ id: 'debrid', icon: 'common/play', key: 'debrid' },
		{ id: 'torrent-search', icon: 'common/search', key: 'torrentSearch' },
		{ id: 'torrent-preferences', icon: 'common/star', key: 'torrentPreferences' }
	],
	[
		{ id: 'manga-sources', icon: 'common/database', key: 'mangaSources' },
		{ id: 'manga-downloads', icon: 'common/folder', key: 'mangaDownloads' }
	],
	[
		{ id: 'book-sources', icon: 'categories/book', key: 'bookSources' },
		{ id: 'book-downloads', icon: 'common/folder', key: 'bookDownloads' }
	]
]
