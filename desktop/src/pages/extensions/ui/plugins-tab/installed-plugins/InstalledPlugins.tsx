import { LuBlocks, LuPuzzle, LuSearchX, LuShoppingBasket } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, LoadFailed, Skeleton } from '@shared/ui'

import type { Extension } from '@entities/extension'

import { InstalledPluginCard } from '@features/manage-plugins'
import type { InstallTarget } from '@features/manage-plugins'

import { CatalogEmpty, CatalogSection } from '../../catalog/Catalog'
import { PluginSections } from '../plugin-sections/PluginSections'

export interface InstalledPluginsProps {
	failed: boolean
	onRetry: () => void
	extensions: Extension[] | null
	shown: Extension[]
	onBrowseCatalog: () => void
	onInstall: (target: InstallTarget) => void
	onSettings: (extension: Extension) => void
}

export function InstalledPlugins({
	failed,
	onRetry,
	extensions,
	shown,
	onBrowseCatalog,
	onInstall,
	onSettings
}: InstalledPluginsProps) {
	const { t } = useTranslation()

	if (failed) {
		return <LoadFailed onRetry={onRetry} />
	}

	if (extensions === null) {
		return <Skeleton height='14rem' radius='var(--radius-lg)' />
	}

	if (extensions.length === 0 || shown.length === 0) {
		return (
			<CatalogSection icon={<LuBlocks size={20} />} title={t('extensions.installed.section')}>
				{extensions.length === 0 ? (
					<CatalogEmpty
						icon={<LuPuzzle size={28} />}
						title={t('plugins.emptyInstalled.title')}
						description={t('plugins.emptyInstalled.description')}
						actions={
							<>
								<Button
									variant='primary'
									startIcon={<LuShoppingBasket size={16} />}
									onClick={onBrowseCatalog}
								>
									{t('extensions.installed.browseCatalog')}
								</Button>
								<Button onClick={() => onInstall({ kind: 'install' })}>
									{t('plugins.addByUrl')}
								</Button>
							</>
						}
					/>
				) : (
					<CatalogEmpty icon={<LuSearchX size={28} />} title={t('extensions.notFound')} />
				)}
			</CatalogSection>
		)
	}

	return (
		<PluginSections items={shown}>
			{extension => (
				<InstalledPluginCard
					key={extension.id}
					extension={extension}
					onUpdate={target => onInstall({ kind: 'update', extension: target })}
					onSettings={onSettings}
				/>
			)}
		</PluginSections>
	)
}
