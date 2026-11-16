import { useCallback } from 'react'

import { problemCode } from '@shared/api'
import { useTranslation } from '@shared/i18n'

export function isMissingBookFolderError(error: unknown): boolean {
	return problemCode(error) === 'books-folder-missing'
}

// Choosing the folder happens on whatever screen the caller leads to; the entity
// only knows the failure.
export function useBookFolderAction(chooseFolder: () => void) {
	const { t } = useTranslation()

	return useCallback(
		(error: unknown) =>
			isMissingBookFolderError(error)
				? {
						label: t('bookSources.copies.chooseFolder'),
						onClick: chooseFolder
					}
				: undefined,
		[chooseFolder, t]
	)
}
