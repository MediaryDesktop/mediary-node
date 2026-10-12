import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { mangaDownloadSettingsQuery, putMangaDownloadSettingsMutation } from '@entities/manga-source'

// The library folder saved chapters go to.
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

	const current = settings?.root_id ? String(settings.root_id) : null

	return (
		<SelectDropdown
			options={(roots?.roots ?? []).map(root => ({ value: String(root.id), label: root.path }))}
			value={current}
			onChange={value => value && save(Number(value))}
			placeholder={t('mangaSources.downloads.folderPlaceholder')}
			disabled={saving}
		/>
	)
}
