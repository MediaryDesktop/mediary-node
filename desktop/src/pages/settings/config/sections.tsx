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
	key: 'app' | 'account' | 'backup' | 'devices' | 'library' | 'metadata' | 'torrents' | 'manga' | 'books'
}

export const SECTION_GROUPS: readonly (readonly SectionInfo[])[] = [
	[{ id: 'app', icon: 'common/settings', key: 'app' }],
	[{ id: 'account', icon: 'common/user', key: 'account' }],
	[
		{ id: 'backup', icon: <IoCloudOutline size={18} />, key: 'backup' },
		{ id: 'devices', icon: <PiDevicesLight size={18} />, key: 'devices' }
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
