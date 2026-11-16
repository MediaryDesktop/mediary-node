import { createEvent, createStore } from 'effector'

import { atom, onEach } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { setLibraryFilesIgnoredMutation, setLibraryMatchesMutation } from '@entities/library-item'
import type { BulkOutcome } from '@entities/library-item'

function reportFailures(outcome: BulkOutcome, message: (count: number) => string, id: string) {
	if (outcome.failed > 0) {
		toast.error(message(outcome.failed), { id })
	}
}

export const unmatchedFilesModel = atom(() => {
	const unmatchedRequested = createEvent()
	const unmatchedClosed = createEvent()

	const ignoredRequested = createEvent()
	const ignoredClosed = createEvent()

	const $unmatchedOpen = createStore(false)
		.on(unmatchedRequested, () => true)
		.reset(unmatchedClosed)

	const $ignoredOpen = createStore(false)
		.on(ignoredRequested, () => true)
		.reset(ignoredClosed)

	onEach(setLibraryMatchesMutation.finished.success, ({ result }) =>
		reportFailures(
			result,
			count => translate('library.match.someFailed', { count }),
			'library-match-failed'
		)
	)

	onEach(setLibraryFilesIgnoredMutation.finished.success, ({ result }) =>
		reportFailures(
			result,
			count => translate('library.unmatched.ignoreFailed', { count }),
			'library-ignore-failed'
		)
	)

	return {
		$unmatchedOpen,
		$ignoredOpen,
		unmatchedRequested,
		unmatchedClosed,
		ignoredRequested,
		ignoredClosed
	}
})
