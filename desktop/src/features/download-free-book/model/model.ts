import { createEvent, createStore, sample } from 'effector'

import {
	bookDownloadSettingsQuery,
	enqueueBookDownloadMutation,
	putBookDownloadSettingsMutation
} from '@entities/book-source'
import type { EnqueueBookDownloadInput } from '@entities/book-source'

export const downloadRequested = createEvent<EnqueueBookDownloadInput>()
export const folderChosen = createEvent<number>()
export const promptClosed = createEvent()

const $pending = createStore<EnqueueBookDownloadInput | null>(null)

export const $promptOpen = createStore(false)

const $hasFolder = bookDownloadSettingsQuery.$data.map(
	settings => settings === null || settings.root_id > 0 || settings.default_folder !== ''
)

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
$pending.reset(promptClosed, enqueueBookDownloadMutation.start)
