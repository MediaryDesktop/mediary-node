import { useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { useNodeQuery } from '@infra/node'

import { extensionCatalogQuery, extensionsQuery } from '@entities/extension'
import type { Extension } from '@entities/extension'

import { LANGUAGES, matchesFilter, usePluginFailures } from '@features/manage-plugins'
import type { InstallTarget } from '@features/manage-plugins'

import { PLUGIN_TYPES } from '../../lib/plugin-types'
import type { PluginTypeFilter } from '../../lib/plugin-types'
import { CatalogFilters } from '../catalog/Catalog'

import { CatalogPlugins } from './catalog-plugins/CatalogPlugins'
import { InstalledPlugins } from './installed-plugins/InstalledPlugins'

export type PluginsView = 'installed' | 'catalog'

export interface PluginsTabProps {
	view: PluginsView
	onBrowseCatalog: () => void
	onInstall: (target: InstallTarget) => void
	onSettings: (extension: Extension) => void
	onRepositories: () => void
}

export function PluginsTab({
	view,
	onBrowseCatalog,
	onInstall,
	onSettings,
	onRepositories
}: PluginsTabProps) {
	const { t } = useTranslation()
	usePluginFailures()

	const installedState = useNodeQuery(extensionsQuery)
	const catalogState = useNodeQuery(extensionCatalogQuery, { params: false })
	const installed = installedState.data
	const catalog = catalogState.data

	const [type, setType] = useState<PluginTypeFilter>('all')
	const [language, setLanguage] = useState('all')
	const [search, setSearch] = useState('')

	const extensions = installed?.extensions ?? null
	const offered = catalog?.plugins ?? null

	const shownInstalled = useMemo(
		() => (extensions ?? []).filter(ext => matchesFilter(ext, { type, language, search })),
		[extensions, type, language, search]
	)
	const shownCatalog = useMemo(
		() => (offered ?? []).filter(plugin => matchesFilter(plugin, { type, language, search })),
		[offered, type, language, search]
	)

	const byID = useMemo(() => new Map((extensions ?? []).map(ext => [ext.id, ext])), [extensions])

	const updateFromCatalog = (id: string) => {
		const ext = byID.get(id)
		if (ext) {
			onInstall({ kind: 'update', extension: ext })
		}
	}

	return (
		<>
			<CatalogFilters
				types={PLUGIN_TYPES.map(value => ({ value, label: t(`plugins.types.${value}`) }))}
				type={type}
				onTypeChange={setType}
				options={[
					{ value: 'all', label: t('extensions.filters.allLanguages') },
					...Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))
				]}
				option={language}
				onOptionChange={setLanguage}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder={
					view === 'installed' ? t('extensions.installed.search') : t('extensions.filters.search')
				}
			/>

			{view === 'installed' ? (
				<InstalledPlugins
					failed={installedState.phase === 'failed'}
					onRetry={installedState.retry}
					extensions={extensions}
					shown={shownInstalled}
					onBrowseCatalog={onBrowseCatalog}
					onInstall={onInstall}
					onSettings={onSettings}
				/>
			) : (
				<CatalogPlugins
					failed={catalogState.phase === 'failed'}
					onRetry={catalogState.retry}
					offered={offered}
					hasRepositories={(catalog?.repositories ?? []).length > 0}
					shown={shownCatalog}
					onInstall={url => onInstall({ kind: 'install', url })}
					onUpdate={updateFromCatalog}
					onRepositories={onRepositories}
				/>
			)}
		</>
	)
}
