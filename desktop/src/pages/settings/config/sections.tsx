import { IoLaptopOutline, IoLibraryOutline } from 'react-icons/io5'

import type { IconLike } from '@shared/ui'

// The settings sections, in the order the menu lists them. The id is what the
// address carries, so a notice elsewhere can open the section it is about.
export const SETTINGS_SECTIONS = [
	'app',
	'backup',
	'devices',
	'library',
	'metadata',
	'torrents',
	'manga',
	'books'
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export function isSettingsSection(value: unknown): value is SettingsSection {
	return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export interface SectionInfo {
	id: SettingsSection
	icon: IconLike
	// The section's keys under settings.sections.
	key: 'app' | 'backup' | 'devices' | 'library' | 'metadata' | 'torrents' | 'manga' | 'books'
}

// The menu's cards: what belongs together sits in one, as in Seanime.
export const SECTION_GROUPS: readonly (readonly SectionInfo[])[] = [
	[{ id: 'app', icon: 'common/settings', key: 'app' }],
	[
		{ id: 'backup', icon: 'common/cloud', key: 'backup' },
		{ id: 'devices', icon: <IoLaptopOutline size={18} />, key: 'devices' }
	],
	[{ id: 'library', icon: <IoLibraryOutline size={18} />, key: 'library' }],
	[
		{ id: 'metadata', icon: 'common/database', key: 'metadata' },
		{ id: 'torrents', icon: 'common/download', key: 'torrents' }
	],
	[
		{ id: 'manga', icon: 'categories/manga', key: 'manga' },
		{ id: 'books', icon: 'categories/book', key: 'books' }
	]
]
