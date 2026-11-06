import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { mangaDownloadSettingsQuery, putMangaDownloadSettingsMutation } from '@entities/manga-source'

export function DownloadFolderSetting() {
	const { t } = useTranslation()

	const [settings, loadSettings, roots, loadRoots, save, saving, nodeReady] = useUnit([
		mangaDownloadSettingsQuery.$data,
		mangaDownloadSettingsQuery.start,
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		putMangaDownloadSettingsMutation.start,
		putMangaDownloadSettingsMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			loadSettings()
			loadRoots()
		}
	}, [loadSettings, loadRoots, nodeReady])

	const folders = roots?.roots ?? []
	const defaultFolder = settings?.default_folder ?? ''
	const current = settings?.root_id || folders.find(root => root.path === defaultFolder)?.id

	return (
		<SelectDropdown
			options={folders.map(root => ({ value: String(root.id), label: root.path }))}
			value={current ? String(current) : null}
			onChange={value => value && save(Number(value))}
			placeholder={defaultFolder || t('mangaSources.downloads.folderPlaceholder')}
			disabled={saving}
		/>
	)
}
