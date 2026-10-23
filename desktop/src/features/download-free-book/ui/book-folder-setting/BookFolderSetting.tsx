import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { bookDownloadSettingsQuery, putBookDownloadSettingsMutation } from '@entities/book-source'
import { libraryRootsQuery } from '@entities/library-item'

// The library folder saved books go to. Only folders of books are offered: the
// node takes no other, so a saved book is in the library at once.
export function BookFolderSetting() {
	const { t } = useTranslation()

	const [settings, loadSettings, roots, loadRoots, save, saving, nodeReady] = useUnit([
		bookDownloadSettingsQuery.$data,
		bookDownloadSettingsQuery.start,
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		putBookDownloadSettingsMutation.start,
		putBookDownloadSettingsMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			loadSettings()
			loadRoots()
		}
	}, [loadSettings, loadRoots, nodeReady])

	const folders = (roots?.roots ?? []).filter(root => root.content === 'books')

	if (roots && folders.length === 0) {
		return <span>{t('bookSources.downloads.noFolders')}</span>
	}

	return (
		<SelectDropdown
			options={folders.map(root => ({ value: String(root.id), label: root.path }))}
			value={settings?.root_id ? String(settings.root_id) : null}
			onChange={value => value && save(Number(value))}
			placeholder={t('bookSources.downloads.folderPlaceholder')}
			disabled={saving}
		/>
	)
}
