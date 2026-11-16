import { useCallback } from 'react'

import { problemCode } from '@shared/api'
import { useTranslation } from '@shared/i18n'

export function isMissingToolError(error: unknown): boolean {
	return problemCode(error) === 'tool-missing'
}

// The way out of a missing tool is wherever the screen keeps the dependencies;
// the caller knows the route, the entity only knows the failure.
export function useMissingToolAction(openDependencies: () => void) {
	const { t } = useTranslation()

	return useCallback(
		(error: unknown) =>
			isMissingToolError(error)
				? {
						label: t('tools.open'),
						onClick: openDependencies
					}
				: undefined,
		[openDependencies, t]
	)
}
