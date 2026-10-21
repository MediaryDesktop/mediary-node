import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LuSearch } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, SegmentedControl, Skeleton, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { checkExtensionUpdatesMutation, extensionCatalogQuery, extensionsQuery } from '@entities/extension'
import type { CatalogPlugin, Extension } from '@entities/extension'

import {
	CatalogPluginCard,
	InstallDialog,
	InstalledPluginCard,
	LANGUAGES,
	matchesFilter,
	PluginSettingsDrawer,
	RepositoriesDrawer,
	usePluginFailures
} from '@features/manage-plugins'
import type { InstallTarget } from '@features/manage-plugins'

import { CatalogEmpty, CatalogFilters, CatalogHeader, CatalogSection } from '../catalog/Catalog'

import styles from './PluginsTab.module.scss'

type View = 'installed' | 'catalog'

// One kind of plugin so far: the type chips are there for the ones to come.
const TYPES = ['all', 'torrent-provider'] as const
type TypeFilter = (typeof TYPES)[number]

// The plugins the user installed, and the ones their repositories offer, in
// Seanime's Installed / Marketplace layout.
export function PluginsTab() {
	const { t } = useTranslation()
	usePluginFailures()

	const [
		installed,
		catalog,
		loadInstalled,
		loadCatalog,
		catalogPending,
		checkUpdates,
		checking,
		nodeReady
	] = useUnit([
		extensionsQuery.$data,
		extensionCatalogQuery.$data,
		extensionsQuery.start,
		extensionCatalogQuery.start,
		extensionCatalogQuery.$pending,
		checkExtensionUpdatesMutation.start,
		checkExtensionUpdatesMutation.$pending,
		$nodeReady
	])

	const [view, setView] = useState<View>('installed')
	const [type, setType] = useState<TypeFilter>('all')
	const [language, setLanguage] = useState('all')
	const [search, setSearch] = useState('')

	const [install, setInstall] = useState<InstallTarget | null>(null)
	const [settings, setSettings] = useState<Extension | null>(null)
	const [repositories, setRepositories] = useState(false)

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
			setInstall({ kind: 'update', extension: ext })
		}
	}

	const updates = (extensions ?? []).filter(ext => ext.update?.version && !ext.update.error).length

	useUnitWatch(checkExtensionUpdatesMutation.finished.success, ({ result }) => {
		const found = (result.extensions ?? []).filter(ext => ext.update?.version && !ext.update.error).length
		toast.success(found ? t('plugins.updatesFound', { count: found }) : t('plugins.noUpdates'), {
			id: 'plugins'
		})
	})

	const actions =
		view === 'installed' ? (
			<>
				<Button loading={checking} onClick={() => checkUpdates()}>
					{t('plugins.checkUpdates')}
				</Button>
				<Button onClick={() => setInstall({ kind: 'install' })}>{t('plugins.addByUrl')}</Button>
			</>
		) : (
			<>
				<Button
					loading={catalogPending}
					onClick={() => {
						loadCatalog(true)
						toast.success(t('extensions.refreshed'), { duration: 1000, id: 'plugins' })
					}}
				>
					{t('extensions.refresh')}
				</Button>
				<Button onClick={() => setRepositories(true)}>{t('plugins.repositories.title')}</Button>
			</>
		)

	const section = (children: ReactNode) => (
		<CatalogSection icon={<LuSearch size={22} />} title={t('plugins.types.torrent-provider')}>
			{children}
		</CatalogSection>
	)

	const body = () => {
		if (view === 'installed') {
			if (extensions === null) {
				return <Skeleton height='14rem' radius='var(--radius-lg)' />
			}
			if (extensions.length === 0) {
				return (
					<CatalogEmpty>
						<strong>{t('plugins.emptyInstalled.title')}</strong>
						<br />
						{t('plugins.emptyInstalled.description')}
					</CatalogEmpty>
				)
			}
			if (shownInstalled.length === 0) {
				return <CatalogEmpty>{t('extensions.notFound')}</CatalogEmpty>
			}

			return section(
				shownInstalled.map(ext => (
					<InstalledPluginCard
						key={ext.id}
						extension={ext}
						onUpdate={target => setInstall({ kind: 'update', extension: target })}
						onSettings={setSettings}
					/>
				))
			)
		}

		if (offered === null) {
			return <Skeleton height='14rem' radius='var(--radius-lg)' />
		}
		if ((catalog?.repositories ?? []).length === 0) {
			return (
				<CatalogEmpty>
					<strong>{t('plugins.emptyCatalog.title')}</strong>
					<br />
					{t('plugins.emptyCatalog.description')}
					<div className={styles.emptyAction}>
						<Button variant='primary' onClick={() => setRepositories(true)}>
							{t('plugins.repositories.add')}
						</Button>
					</div>
				</CatalogEmpty>
			)
		}
		if (shownCatalog.length === 0) {
			return <CatalogEmpty>{t('extensions.notFound')}</CatalogEmpty>
		}

		return section(
			shownCatalog.map((plugin: CatalogPlugin) => (
				<CatalogPluginCard
					key={plugin.manifest_url}
					plugin={plugin}
					onInstall={url => setInstall({ kind: 'install', url })}
					onUpdate={updateFromCatalog}
				/>
			))
		)
	}

	return (
		<>
			<CatalogHeader
				title={t('extensions.extensions.title')}
				subtitle={t('extensions.extensions.subtitle')}
				actions={actions}
			/>

			<SegmentedControl
				className={styles.view}
				label={t('extensions.extensions.title')}
				value={view}
				onValueChange={setView}
				items={[
					{
						value: 'installed',
						label: updates
							? t('plugins.view.installedWithUpdates', { count: updates })
							: t('plugins.view.installed')
					},
					{ value: 'catalog', label: t('plugins.view.catalog') }
				]}
			/>

			<CatalogFilters
				types={TYPES.map(value => ({ value, label: t(`plugins.types.${value}`) }))}
				type={type}
				onTypeChange={setType}
				options={[
					{ value: 'all', label: t('extensions.extensions.allLanguages') },
					...Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))
				]}
				option={language}
				onOptionChange={setLanguage}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder={t('extensions.extensions.search')}
			/>

			{body()}

			<InstallDialog target={install} onClose={() => setInstall(null)} />
			<PluginSettingsDrawer extension={settings} onClose={() => setSettings(null)} />
			<RepositoriesDrawer open={repositories} onClose={() => setRepositories(false)} />
		</>
	)
}
