import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'

export function isMissingToolError(error: unknown): boolean {
	const failure = error as { status?: number; body?: { detail?: string } | null } | null

	return failure?.status === 428 && (failure.body?.detail ?? '').includes('was not found')
}

export function useMissingToolAction() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return useCallback(
		(error: unknown) =>
			isMissingToolError(error)
				? {
						label: t('tools.open'),
						onClick: () => void navigate({ to: '/extensions', search: { tab: 'dependencies' } })
					}
				: undefined,
		[navigate, t]
	)
}
