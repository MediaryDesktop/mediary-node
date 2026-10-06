import { createEvent, createStore, sample } from 'effector'

import { addTorrentMutation } from '@entities/torrent'

// The download whose files are being chosen, wherever its row is shown.
export const filesRequested = createEvent<number>()
export const filesDismissed = createEvent()

export const $filesFor = createStore<number | null>(null)
	.on(filesRequested, (_, id) => id)
	.reset(filesDismissed)

// A torrent added to choose its files first opens the choice straight away.
sample({
	clock: addTorrentMutation.finished.success,
	filter: ({ result }) => result.choosing,
	fn: ({ result }) => result.id,
	target: filesRequested
})
