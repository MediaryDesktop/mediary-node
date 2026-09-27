import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { libraryScanQuery, startLibraryScanMutation } from '@entities/library-item'

export const scanLibraryModel = atom(() => {
	const requested = createEvent()
	const closed = createEvent()

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed)

	// What the last scan did is asked for when the modal opens: the socket carries
	// progress, not the outcome of a scan that ended before anyone looked.
	sample({ clock: requested, target: libraryScanQuery.start })

	startLibraryScanMutation.finished.failure.watch(({ error }) => {
		toast.error(error.body?.detail ?? translate('library.scan.failed'), { id: 'library-scan-failed' })
	})

	return { $open, requested, closed }
})
