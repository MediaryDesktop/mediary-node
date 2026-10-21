import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LuBlocks, LuDatabase, LuPuzzle, LuSearchX, LuShoppingBasket } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, Skeleton } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { extensionCatalogQuery, extensionsQuery } from '@entities/extension'
import type { CatalogPlugin, Extension } from '@entities/extension'

import {
	CatalogPluginCard,
	InstalledPluginCard,
	LANGUAGES,
	matchesFilter,
	usePluginFailures
} from '@features/manage-plugins'
import type { InstallTarget } from '@features/manage-plugins'

import { CatalogEmpty, CatalogFilters, CatalogSection } from '../catalog/Catalog'

export type PluginsView = 'installed' | 'catalog'

export interface PluginsTabProps {
	view: PluginsView
	onBrowseCatalog: () => void
	onInstall: (target: InstallTarget) => void
	onSettings: (extension: Extension) => void
	onRepositories: () => void
}

// One kind of plugin so far: the types are there for the ones to come.
const TYPES = ['all', 'torrent-provider'] as const
type TypeFilter = (typeof TYPES)[number]

// The plugins the user installed, or the ones their repositories offer: two
// tabs of the page, which owns the dialogs they open.
export function PluginsTab({
	view,
	onBrowseCatalog,
	onInstall,
	onSettings,
	onRepositories
}: PluginsTabProps) {
	const { t } = useTranslation()
	usePluginFailures()

	const [installed, catalog, loadInstalled, loadCatalog, nodeReady] = useUnit([
		extensionsQuery.$data,
		extensionCatalogQuery.$data,
		extensionsQuery.start,
		extensionCatalogQuery.start,
		$nodeReady
	])

	const [type, setType] = useState<TypeFilter>('all')
	const [language, setLanguage] = useState('all')
	const [search, setSearch] = useState('')

	useEffect(() => {
		if (nodeReady) {
			loadInstalled()
			loadCatalog(false)
		}
	}, [loadInstalled, loadCatalog, nodeReady])

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

	const notFound = <CatalogEmpty icon={<LuSearchX size={28} />} title={t('extensions.notFound')} />

	const body = () => {
		if (view === 'installed') {
			const section = (children: ReactNode) => (
				<CatalogSection
					icon={<LuBlocks size={20} />}
					title={t('extensions.installed.section')}
					description={t('extensions.installed.description')}
				>
					{children}
				</CatalogSection>
			)

			if (extensions === null) {
				return <Skeleton height='14rem' radius='var(--radius-lg)' />
			}
			if (extensions.length === 0) {
				return section(
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
				)
			}

			return section(
				shownInstalled.length === 0
					? notFound
					: shownInstalled.map(ext => (
							<InstalledPluginCard
								key={ext.id}
								extension={ext}
								onUpdate={target => onInstall({ kind: 'update', extension: target })}
								onSettings={onSettings}
							/>
						))
			)
		}

		if (offered === null) {
			return <Skeleton height='14rem' radius='var(--radius-lg)' />
		}

		const repositories = catalog?.repositories ?? []
		if (repositories.length === 0) {
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

		return (
			<CatalogSection
				icon={<LuBlocks size={20} />}
				title={t('extensions.catalog.section')}
				description={t('extensions.catalog.description', {
					repositories: repositories.map(repository => repository.name).join(', ')
				})}
			>
				{shownCatalog.length === 0
					? notFound
					: shownCatalog.map((plugin: CatalogPlugin) => (
							<CatalogPluginCard
								key={plugin.manifest_url}
								plugin={plugin}
								onInstall={url => onInstall({ kind: 'install', url })}
								onUpdate={updateFromCatalog}
							/>
						))}
			</CatalogSection>
		)
	}

	return (
		<>
			<CatalogFilters
				types={TYPES.map(value => ({ value, label: t(`plugins.types.${value}`) }))}
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

			{body()}
		</>
	)
}
