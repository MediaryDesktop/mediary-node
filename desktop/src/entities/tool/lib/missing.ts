import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'

// The node answers 428 when mpv or FFmpeg is nowhere, with a message that says
// where to get it; whoever shows the error can then offer the way there.
export function isMissingToolError(error: unknown): boolean {
	const failure = error as { status?: number; body?: { detail?: string } | null } | null

	return failure?.status === 428 && (failure.body?.detail ?? '').includes('was not found')
}

// A toast's button to the Dependencies tab, for an error about a missing
// program; undefined for any other error.
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
