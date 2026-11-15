import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { problemCode } from '@shared/api'
import { useTranslation } from '@shared/i18n'

export function isMissingBookFolderError(error: unknown): boolean {
	return problemCode(error) === 'books-folder-missing'
}

export function useBookFolderAction() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return useCallback(
		(error: unknown) =>
			isMissingBookFolderError(error)
				? {
						label: t('bookSources.copies.chooseFolder'),
						onClick: () => void navigate({ to: '/settings', search: { section: 'books' } })
					}
				: undefined,
		[navigate, t]
	)
}
