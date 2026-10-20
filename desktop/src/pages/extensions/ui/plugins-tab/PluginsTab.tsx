import { useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { CatalogEmpty, CatalogFilters, CatalogHeader } from '../catalog/Catalog'

const TYPES = ['all', 'plugins', 'animeTorrents', 'manga', 'onlineStreaming', 'customSources'] as const

type ExtensionType = (typeof TYPES)[number]

// Languages by their own names, as Seanime lists them; a source in any other
// language still shows under all of them.
const LANGUAGES = [
	{ value: 'en', label: 'English' },
	{ value: 'uk', label: 'Українська' },
	{ value: 'ru', label: 'Русский' },
	{ value: 'ja', label: '日本語' },
	{ value: 'multi', label: 'Multi' }
]

// Plugins come in phase 2. Until then the filters are there and the list is
// empty, so the page already has the shape it will keep.
export function PluginsTab() {
	const { t } = useTranslation()

	const [type, setType] = useState<ExtensionType>('all')
	const [language, setLanguage] = useState('all')
	const [search, setSearch] = useState('')

	return (
		<>
			<CatalogHeader
				title={t('extensions.extensions.title')}
				subtitle={t('extensions.extensions.subtitle')}
			/>

			<CatalogFilters
				types={TYPES.map(value => ({ value, label: t(`extensions.extensions.types.${value}`) }))}
				type={type}
				onTypeChange={setType}
				options={[{ value: 'all', label: t('extensions.extensions.allLanguages') }, ...LANGUAGES]}
				option={language}
				onOptionChange={setLanguage}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder={t('extensions.extensions.search')}
			/>

			<CatalogEmpty>
				<strong>{t('extensions.extensions.emptyTitle')}</strong>
				<br />
				{t('extensions.extensions.emptyDescription')}
			</CatalogEmpty>
		</>
	)
}
