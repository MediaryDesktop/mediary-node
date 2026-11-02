import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'

// The node answers 428 when no library folder of books is chosen, the chosen
// one is gone, or it holds something else — every such message names "folder
// for books".
export function isMissingBookFolderError(error: unknown): boolean {
	const failure = error as { status?: number; body?: { detail?: string } | null } | null

	return failure?.status === 428 && (failure.body?.detail ?? '').includes('folder for books')
}

// A toast's button to the book downloads settings, for an error about the
// folder for books; undefined for any other error.
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
