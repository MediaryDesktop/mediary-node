import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { setupRequired } from '@shared/api'
import { useTranslation } from '@shared/i18n'

export function isMissingBookFolderError(error: unknown): boolean {
	return setupRequired(error)?.includes('folder for books') ?? false
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
