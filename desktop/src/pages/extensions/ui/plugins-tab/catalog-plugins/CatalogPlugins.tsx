import { LuBlocks, LuDatabase, LuSearchX } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, LoadFailed, Skeleton } from '@shared/ui'

import type { CatalogPlugin } from '@entities/extension'

import { CatalogPluginCard } from '@features/manage-plugins'

import { CatalogEmpty, CatalogSection } from '../../catalog/Catalog'
import { PluginSections } from '../plugin-sections/PluginSections'

export interface CatalogPluginsProps {
	failed: boolean
	onRetry: () => void
	offered: CatalogPlugin[] | null
	hasRepositories: boolean
	shown: CatalogPlugin[]
	onInstall: (url: string) => void
	onUpdate: (id: string) => void
	onRepositories: () => void
}

export function CatalogPlugins({
	failed,
	onRetry,
	offered,
	hasRepositories,
	shown,
	onInstall,
	onUpdate,
	onRepositories
}: CatalogPluginsProps) {
	const { t } = useTranslation()

	if (failed) {
		return <LoadFailed onRetry={onRetry} />
	}

	if (offered === null) {
		return <Skeleton height='14rem' radius='var(--radius-lg)' />
	}

	if (!hasRepositories) {
		return (
			<CatalogEmpty
				icon={<LuDatabase size={28} />}
				title={t('plugins.emptyCatalog.title')}
				description={t('plugins.emptyCatalog.description')}
				actions={
					<Button variant='primary' onClick={onRepositories}>
						{t('plugins.repositories.add')}
					</Button>
				}
			/>
		)
	}

	if (shown.length === 0) {
		return (
			<CatalogSection icon={<LuBlocks size={20} />} title={t('extensions.catalog.section')}>
				<CatalogEmpty icon={<LuSearchX size={28} />} title={t('extensions.notFound')} />
			</CatalogSection>
		)
	}

	return (
		<PluginSections items={shown}>
			{plugin => (
				<CatalogPluginCard
					key={plugin.manifest_url}
					plugin={plugin}
					onInstall={onInstall}
					onUpdate={onUpdate}
				/>
			)}
		</PluginSections>
	)
}
