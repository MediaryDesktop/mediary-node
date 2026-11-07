import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu } from '@shared/ui'
import type { IconName } from '@shared/ui'

import type { LibraryContent } from '../../api/api'
import { libraryModel } from '../../model/model'

export const LIBRARY_CONTENTS = [
	'anime',
	'movies_and_shows',
	'doramas',
	'mixed',
	'manga',
	'books'
] as const satisfies readonly LibraryContent[]

export const LIBRARY_CONTENT_ICONS: Record<LibraryContent, IconName> = {
	anime: 'categories/anime',
	movies_and_shows: 'categories/movie',
	doramas: 'categories/doramas',
	mixed: 'common/folder',
	manga: 'categories/manga',
	books: 'categories/book'
}

export interface AddRootMenuProps {
	trigger: ReactNode
	align?: 'start' | 'center' | 'end'
}

export function AddRootMenu({ trigger, align }: AddRootMenuProps) {
	const { t } = useTranslation()
	const [pickingFolder, folderRequested] = useUnit([
		libraryModel.$pickingFolder,
		libraryModel.folderRequested
	])

	return (
		<DropdownMenu
			align={align}
			items={LIBRARY_CONTENTS.map(content => ({
				id: content,
				label: t(`library.root.addAs.${content}`),
				icon: LIBRARY_CONTENT_ICONS[content],
				disabled: pickingFolder,
				onSelect: () => folderRequested(content)
			}))}
			trigger={trigger}
		/>
	)
}
