import { createEvent, createStore, sample } from 'effector'

import {
	enqueueMangaDownloadsMutation,
	mangaDownloadSettingsQuery,
	putMangaDownloadSettingsMutation
} from '@entities/manga-source'

export const downloadRequested = createEvent<string[]>()
export const folderChosen = createEvent<number>()
export const promptClosed = createEvent()

const $pending = createStore<string[]>([])

export const $promptOpen = createStore(false)

const $hasFolder = mangaDownloadSettingsQuery.$data.map(
	settings => settings === null || settings.root_id > 0 || settings.default_folder !== ''
)

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: (hasFolder, refs) => hasFolder && refs.length > 0,
	fn: (_, refs) => refs,
	target: enqueueMangaDownloadsMutation.start
})

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: (hasFolder, refs) => !hasFolder && refs.length > 0,
	fn: (_, refs) => refs,
	target: $pending
})

sample({
	clock: downloadRequested,
	source: $hasFolder,
	filter: (hasFolder, refs) => !hasFolder && refs.length > 0,
	fn: () => true,
	target: $promptOpen
})

sample({ clock: folderChosen, target: putMangaDownloadSettingsMutation.start })

sample({
	clock: putMangaDownloadSettingsMutation.finished.success,
	source: $pending,
	filter: pending => pending.length > 0,
	target: enqueueMangaDownloadsMutation.start
})

$promptOpen.reset(promptClosed, putMangaDownloadSettingsMutation.finished.success)
$pending.reset(promptClosed, enqueueMangaDownloadsMutation.start)
