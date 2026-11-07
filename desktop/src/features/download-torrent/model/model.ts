import { createEvent, createStore, sample } from 'effector'

import { ownRequest } from '@shared/factory'

import { addTorrentMutation } from '@entities/torrent'

// The drawer and the quick-add field sit on the same page and add through the
// same mutation; each closes or clears on its own add only.
export const drawerAdd = ownRequest(addTorrentMutation)
export const quickAdd = ownRequest(addTorrentMutation)

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
