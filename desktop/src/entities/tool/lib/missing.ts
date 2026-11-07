import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { setupRequired } from '@shared/api'
import { useTranslation } from '@shared/i18n'

export function isMissingToolError(error: unknown): boolean {
	return setupRequired(error)?.includes('was not found') ?? false
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
