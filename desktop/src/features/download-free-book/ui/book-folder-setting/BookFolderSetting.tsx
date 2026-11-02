import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { bookDownloadSettingsQuery, putBookDownloadSettingsMutation } from '@entities/book-source'
import { libraryRootsQuery } from '@entities/library-item'

// The library folder saved books go to. Only folders of books are offered: the
// node takes no other, so a saved book is in the library at once. Until the user
// picks one, the node's own folder for books is shown: books go there, and it
// joins the library on the first.
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
	const defaultFolder = settings?.default_folder ?? ''
	const current = settings?.root_id || folders.find(root => root.path === defaultFolder)?.id

	if (roots && settings && folders.length === 0 && !defaultFolder) {
		return <span>{t('bookSources.downloads.noFolders')}</span>
	}

	return (
		<SelectDropdown
			options={folders.map(root => ({ value: String(root.id), label: root.path }))}
			value={current ? String(current) : null}
			onChange={value => value && save(Number(value))}
			placeholder={defaultFolder || t('bookSources.downloads.folderPlaceholder')}
			disabled={saving}
		/>
	)
}
