import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { trackerModel } from '@entities/tracker'

trackerModel.entryUpdateFailed.watch(() => {
	toast.error(translate('lists.updateFailed'), { id: 'tracker-update-failed' })
})
