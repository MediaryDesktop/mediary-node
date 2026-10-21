import { useUnit } from 'effector-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { IoExtensionPuzzleOutline } from 'react-icons/io5'
import { LuBox, LuLink, LuPlus, LuShoppingBasket } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, PageHeader, PageTransition, PhaseTransition, SegmentedControl } from '@shared/ui'

import { extensionsQuery } from '@entities/extension'
import type { Extension } from '@entities/extension'

import { InstallDialog, PluginSettingsDrawer, RepositoriesDrawer } from '@features/manage-plugins'
import type { InstallTarget } from '@features/manage-plugins'

import styles from './ExtensionsPage.module.scss'
import { CatalogActions, DependenciesActions, InstalledActions } from './ui/actions/Actions'
import { DependenciesTab } from './ui/dependencies-tab/DependenciesTab'
import { PluginsTab } from './ui/plugins-tab/PluginsTab'

export const EXTENSIONS_TABS = ['installed', 'catalog', 'dependencies'] as const

export type ExtensionsTab = (typeof EXTENSIONS_TABS)[number]

export function isExtensionsTab(value: unknown): value is ExtensionsTab {
	return typeof value === 'string' && (EXTENSIONS_TABS as readonly string[]).includes(value)
}

const TAB_ICONS: Record<ExtensionsTab, ReactNode> = {
	installed: <LuBox size={18} />,
	catalog: <LuShoppingBasket size={18} />,
	dependencies: <LuLink size={18} />
}

export interface ExtensionsPageProps {
	tab: ExtensionsTab
	onTabChange: (tab: ExtensionsTab) => void
}

// The plugins the user installed, the ones their repositories offer, and the
// programs the node runs, which Mediary installs itself: one tab each. The
// dialogs belong to the page, since the header opens them from any plugin tab.
export function ExtensionsPage({ tab, onTabChange }: ExtensionsPageProps) {
	const { t } = useTranslation()
	const installed = useUnit(extensionsQuery.$data)

	const [install, setInstall] = useState<InstallTarget | null>(null)
	const [settings, setSettings] = useState<Extension | null>(null)
	const [repositories, setRepositories] = useState(false)

	const updates = (installed?.extensions ?? []).filter(
		ext => ext.update?.version && !ext.update.error
	).length

	const label = (value: ExtensionsTab) =>
		value === 'installed' && updates
			? t('extensions.installed.tabWithUpdates', { count: updates })
			: t(`extensions.${value}.tab`)

	const actions =
		tab === 'installed' ? (
			<InstalledActions />
		) : tab === 'catalog' ? (
			<CatalogActions onRepositories={() => setRepositories(true)} />
		) : (
			<DependenciesActions />
		)

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.extensions')}
				icon={<IoExtensionPuzzleOutline size={24} />}
				subtitle={t('extensions.subtitle')}
				rightContent={
					tab !== 'dependencies' && (
						<Button
							variant='primary'
							startIcon={<LuPlus size={16} />}
							onClick={() => setInstall({ kind: 'install' })}
						>
							{t('plugins.addByUrl')}
						</Button>
					)
				}
			/>

			<div className={styles.bar}>
				<SegmentedControl
					size='large'
					label={t('nav.extensions')}
					value={tab}
					onValueChange={onTabChange}
					items={EXTENSIONS_TABS.map(value => ({
						value,
						label: (
							<span className={styles.tabLabel}>
								{TAB_ICONS[value]}
								{label(value)}
							</span>
						)
					}))}
				/>

				<div className={styles.actions}>{actions}</div>
			</div>

			<PhaseTransition phase={tab} className={styles.content}>
				{tab === 'dependencies' ? (
					<DependenciesTab />
				) : (
					<PluginsTab
						view={tab}
						onBrowseCatalog={() => onTabChange('catalog')}
						onInstall={setInstall}
						onSettings={setSettings}
						onRepositories={() => setRepositories(true)}
					/>
				)}
			</PhaseTransition>

			<InstallDialog target={install} onClose={() => setInstall(null)} />
			<PluginSettingsDrawer extension={settings} onClose={() => setSettings(null)} />
			<RepositoriesDrawer open={repositories} onClose={() => setRepositories(false)} />
		</PageTransition>
	)
}
