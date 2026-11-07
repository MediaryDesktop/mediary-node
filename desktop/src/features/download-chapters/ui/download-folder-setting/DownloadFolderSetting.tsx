import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { mangaDownloadSettingsQuery, putMangaDownloadSettingsMutation } from '@entities/manga-source'

export function DownloadFolderSetting() {
	const { t } = useTranslation()

	const [settings, roots, save, saving] = useUnit([
		mangaDownloadSettingsQuery.$data,
		libraryRootsQuery.$data,
		putMangaDownloadSettingsMutation.start,
		putMangaDownloadSettingsMutation.$pending
	])

	useNodeData(mangaDownloadSettingsQuery)
	useNodeData(libraryRootsQuery)

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
