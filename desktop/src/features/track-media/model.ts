import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { trackerModel } from '@entities/tracker'

const SYNC_TOAST = 'tracker-sync'
const SYNC_PATIENCE_MS = 10_000

let syncing = false
let patience: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
	if (patience !== null) {
		clearTimeout(patience)
		patience = null
	}
}

trackerModel.entryUpdated.watch(({ result }) => {
	if (!result.sync_pending) {
		return
	}

	syncing = true
	stopWaiting()

	toast.loading(translate('lists.sync.progress'), { id: SYNC_TOAST })

	patience = setTimeout(() => {
		patience = null
		toast.warning(translate('lists.sync.delayed'), { id: SYNC_TOAST })
	}, SYNC_PATIENCE_MS)
})

trackerModel.entriesSynced.watch(() => {
	if (!syncing) {
		return
	}

	syncing = false
	stopWaiting()

	toast.success(translate('lists.sync.done'), { id: SYNC_TOAST })
})

trackerModel.entryUpdateFailed.watch(() => {
	syncing = false
	stopWaiting()

	toast.dismiss(SYNC_TOAST)
	toast.error(translate('lists.updateFailed'), { id: 'tracker-update-failed' })
})
