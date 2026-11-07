import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { bookDownloadSettingsQuery, putBookDownloadSettingsMutation } from '@entities/book-source'
import { libraryRootsQuery } from '@entities/library-item'

export function BookFolderSetting() {
	const { t } = useTranslation()

	const [settings, roots, save, saving] = useUnit([
		bookDownloadSettingsQuery.$data,
		libraryRootsQuery.$data,
		putBookDownloadSettingsMutation.start,
		putBookDownloadSettingsMutation.$pending
	])

	useNodeData(bookDownloadSettingsQuery)
	useNodeData(libraryRootsQuery)

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
