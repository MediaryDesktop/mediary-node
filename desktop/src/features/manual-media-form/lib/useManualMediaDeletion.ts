import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { manualDeletion } from '../model/model'

// Removing a hand-made title, from the form or from the title's own page. What
// to show once it is gone is the caller's to decide.
export function useManualMediaDeletion(onDeleted: () => void) {
	const { t } = useTranslation()
	const [remove, deleting] = useUnit([manualDeletion.sent, manualDeletion.$pending])

	useUnitWatch(manualDeletion.succeeded, () => onDeleted())
	useUnitWatch(manualDeletion.failed, ({ error }) =>
		toast.error(problemDetail(error, t('manualMedia.delete.failed')), { id: 'manual-media-delete' })
	)

	return { remove, deleting }
}
