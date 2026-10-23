import { createEvent, createStore, sample } from 'effector'

import {
	bookDownloadSettingsQuery,
	enqueueBookDownloadMutation,
	putBookDownloadSettingsMutation
} from '@entities/book-source'
import type { EnqueueBookDownloadInput } from '@entities/book-source'

// A copy to save. It goes straight to the queue when a folder for books is
// chosen; otherwise the user is asked for one first, and it goes after that.
export const downloadRequested = createEvent<EnqueueBookDownloadInput>()
export const folderChosen = createEvent<number>()
export const promptClosed = createEvent()

const $pending = createStore<EnqueueBookDownloadInput | null>(null)

export const $promptOpen = createStore(false)

// An answer not yet in counts as a folder: the node refuses a download without
// one, and says why.
const $hasFolder = bookDownloadSettingsQuery.$data.map(settings => settings === null || settings.root_id > 0)

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: hasFolder => hasFolder,
	fn: (_, book) => book,
	target: enqueueBookDownloadMutation.start
})

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: hasFolder => !hasFolder,
	fn: (_, book) => book,
	target: $pending
})

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: hasFolder => !hasFolder,
	fn: () => true,
	target: $promptOpen
})

sample({ clock: folderChosen, target: putBookDownloadSettingsMutation.start })

sample({
	clock: putBookDownloadSettingsMutation.finished.success,
	source: $pending,
	filter: (pending): pending is EnqueueBookDownloadInput => pending !== null,
	target: enqueueBookDownloadMutation.start
})

$promptOpen.reset(promptClosed, putBookDownloadSettingsMutation.finished.success)
// Cleared once it has gone to the queue, not with the folder: both happen on the
// same answer, and the queue has to read it first.
$pending.reset(promptClosed, enqueueBookDownloadMutation.start)
