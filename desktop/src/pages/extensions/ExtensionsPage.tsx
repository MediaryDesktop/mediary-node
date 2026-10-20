import type { ReactNode } from 'react'
import { IoExtensionPuzzleOutline } from 'react-icons/io5'
import { LuPackageCheck } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { PageTransition, PhaseTransition, SegmentedControl } from '@shared/ui'

import styles from './ExtensionsPage.module.scss'
import { DependenciesTab } from './ui/dependencies-tab/DependenciesTab'
import { PluginsTab } from './ui/plugins-tab/PluginsTab'

export const EXTENSIONS_TABS = ['extensions', 'dependencies'] as const

export type ExtensionsTab = (typeof EXTENSIONS_TABS)[number]

export function isExtensionsTab(value: unknown): value is ExtensionsTab {
	return typeof value === 'string' && (EXTENSIONS_TABS as readonly string[]).includes(value)
}

const TAB_ICONS: Record<ExtensionsTab, ReactNode> = {
	extensions: <IoExtensionPuzzleOutline size={18} />,
	dependencies: <LuPackageCheck size={18} />
}

export interface ExtensionsPageProps {
	tab: ExtensionsTab
	onTabChange: (tab: ExtensionsTab) => void
}

// Seanime's extensions page: two tabs centred on top, then the tab as a
// marketplace. Plugins add sources; the programs the node runs are installed
// by Mediary itself.
export function ExtensionsPage({ tab, onTabChange }: ExtensionsPageProps) {
	const { t } = useTranslation()

	return (
		<PageTransition className={styles.root}>
			<SegmentedControl
				size='large'
				className={styles.tabs}
				label={t('nav.extensions')}
				value={tab}
				onValueChange={onTabChange}
				items={EXTENSIONS_TABS.map(value => ({
					value,
					label: (
						<span className={styles.tabLabel}>
							{TAB_ICONS[value]}
							{t(`extensions.${value}.tab`)}
						</span>
					)
				}))}
			/>

			<PhaseTransition phase={tab} className={styles.content}>
				{tab === 'extensions' ? <PluginsTab /> : <DependenciesTab />}
			</PhaseTransition>
		</PageTransition>
	)
}
