import { createEvent, createStore, sample } from 'effector'

import { addTorrentMutation } from '@entities/torrent'

export const filesRequested = createEvent<number>()
export const filesDismissed = createEvent()

export const $filesFor = createStore<number | null>(null)
	.on(filesRequested, (_, id) => id)
	.reset(filesDismissed)

sample({
	clock: addTorrentMutation.finished.success,
	filter: ({ result }) => result.choosing,
	fn: ({ result }) => result.id,
	target: filesRequested
})
