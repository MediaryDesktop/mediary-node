import { createEvent, createStore, sample } from 'effector'

import { problemDetail } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { libraryScanQuery, startLibraryScanMutation } from '@entities/library-item'

export const scanLibraryModel = atom(() => {
	const requested = createEvent()
	const closed = createEvent()

	// 0 walks every folder, which is what the modal means until one is picked.
	const started = createEvent<number>()

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed, started)

	sample({ clock: requested, target: libraryScanQuery.start })

	// The modal only starts the scan and gets out of the way: progress is drawn
	// over whatever page the user moves on to, not inside a dialog they would
	// have to keep open to watch.
	sample({ clock: started, target: startLibraryScanMutation.start })

	startLibraryScanMutation.finished.failure.watch(({ error }) => {
		toast.error(problemDetail(error, translate('library.scan.failed')), { id: 'library-scan-failed' })
	})

	return { $open, requested, closed, started }
})
