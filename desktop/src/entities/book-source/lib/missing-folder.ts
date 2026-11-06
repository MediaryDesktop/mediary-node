import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'

export function isMissingBookFolderError(error: unknown): boolean {
	const failure = error as { status?: number; body?: { detail?: string } | null } | null

	return failure?.status === 428 && (failure.body?.detail ?? '').includes('folder for books')
}

export function useBookFolderAction() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return useCallback(
		(error: unknown) =>
			isMissingBookFolderError(error)
				? {
						label: t('bookSources.copies.chooseFolder'),
						onClick: () =>
							void navigate({ to: '/settings', search: { section: 'books' } })
					}
				: undefined,
		[navigate, t]
	)
}
