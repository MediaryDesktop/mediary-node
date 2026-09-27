import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import {
	deleteLibraryFileMutation,
	LIBRARY_PAGE_SIZE,
	libraryFilesQuery,
	setLibraryFileIgnoredMutation
} from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

export type UnmatchedView = 'unmatched' | 'ignored'

export const unmatchedFilesModel = atom(() => {
	const requested = createEvent()
	const closed = createEvent()
	const viewChanged = createEvent<UnmatchedView>()

	const deleteRequested = createEvent<LibraryFile>()
	const deleteCancelled = createEvent()
	const deleteConfirmed = createEvent()

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed)

	const $view = createStore<UnmatchedView>('unmatched').on(viewChanged, (_, view) => view)

	const $pendingDelete = createStore<LibraryFile | null>(null)
		.on(deleteRequested, (_, file) => file)
		.reset(deleteCancelled, deleteConfirmed, closed)

	// Each view is its own slice of the library, so opening the drawer or moving
	// between the two asks the node for that slice rather than filtering a page it
	// already has — the page would only hold the first few hundred files anyway.
	sample({
		clock: [requested, viewChanged],
		source: $view,
		fn: (view: UnmatchedView) => ({
			unmatched: view === 'unmatched',
			ignored: view === 'ignored',
			limit: LIBRARY_PAGE_SIZE
		}),
		target: libraryFilesQuery.start
	})

	sample({
		clock: deleteConfirmed,
		source: $pendingDelete,
		filter: (file): file is LibraryFile => file !== null,
		fn: (file: LibraryFile) => file.id,
		target: deleteLibraryFileMutation.start
	})

	deleteLibraryFileMutation.finished.failure.watch(({ error }) => {
		toast.error(error.body?.detail ?? translate('library.file.deleteFailed'), {
			id: 'library-file-delete-failed'
		})
	})

	setLibraryFileIgnoredMutation.finished.failure.watch(() => {
		toast.error(translate('library.file.ignoreFailed'), { id: 'library-file-ignore-failed' })
	})

	return {
		$open,
		$view,
		$pendingDelete,
		requested,
		closed,
		viewChanged,
		deleteRequested,
		deleteCancelled,
		deleteConfirmed,
		ignoreRequested: setLibraryFileIgnoredMutation.start
	}
})
