import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import {
	checkExtensionUpdatesMutation,
	configureExtensionMutation,
	removeExtensionMutation
} from '@entities/extension'

// What the plugin list's own buttons do — turn on or off, remove, check for
// updates — says so in a toast when it fails.
export function usePluginFailures() {
	const { t } = useTranslation()

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('plugins.actionFailed')), { id: 'plugins' })

	useUnitWatch(configureExtensionMutation.finished.failure, failed)
	useUnitWatch(removeExtensionMutation.finished.failure, failed)
	useUnitWatch(checkExtensionUpdatesMutation.finished.failure, failed)
}
