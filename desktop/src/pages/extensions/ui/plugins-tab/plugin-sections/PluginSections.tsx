import type { ReactNode } from 'react'
import { LuBlocks, LuBookOpen, LuMagnet } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'

import { byType, isPluginType } from '../../../lib/plugin-types'
import { CatalogSection } from '../../catalog/Catalog'

const SECTION_ICONS: Record<string, ReactNode> = {
	'torrent-provider': <LuMagnet size={20} />,
	'manga-provider': <LuBookOpen size={20} />
}

export interface PluginSectionsProps<T extends { type: string }> {
	items: T[]
	children: (item: T) => ReactNode
}

export function PluginSections<T extends { type: string }>({ items, children }: PluginSectionsProps<T>) {
	const { t } = useTranslation()

	return byType(items).map(([kind, group]) => (
		<CatalogSection
			key={kind}
			icon={SECTION_ICONS[kind] ?? <LuBlocks size={20} />}
			title={isPluginType(kind) ? t(`plugins.types.${kind}`) : kind}
		>
			{group.map(children)}
		</CatalogSection>
	))
}
