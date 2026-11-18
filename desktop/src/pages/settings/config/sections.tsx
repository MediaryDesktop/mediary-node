import { IoCloudOutline, IoLibraryOutline } from 'react-icons/io5'
import { PiDevicesLight } from 'react-icons/pi'

import type { IconLike } from '@shared/ui'

export const SETTINGS_SECTIONS = [
	'app',
	'account',
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
}

export const SECTION_GROUPS: readonly (readonly SectionInfo[])[] = [
	[{ id: 'app', icon: 'common/settings' }],
	[{ id: 'account', icon: 'common/user' }],
	[
		{ id: 'backup', icon: <IoCloudOutline size={18} /> },
		{ id: 'devices', icon: <PiDevicesLight size={18} /> }
	],
	[{ id: 'library', icon: <IoLibraryOutline size={18} /> }],
	[
		{ id: 'metadata', icon: 'common/database' },
		{ id: 'torrents', icon: 'common/download' }
	],
	[
		{ id: 'manga', icon: 'categories/manga' },
		{ id: 'books', icon: 'categories/book' }
	]
]
