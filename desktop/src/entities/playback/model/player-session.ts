import { createEvent, createStore } from 'effector'

export const playerOpened = createEvent<number>()
export const playerOpening = createEvent()
export const playerClosed = createEvent()
export const playerMinimized = createEvent()
export const playerExpanded = createEvent()

export const $playerFileId = createStore<number | null>(null)
	.on(playerOpened, (_, fileId) => fileId)
	.reset(playerClosed)

export const $playerOpenedAt = createStore<number | null>(null)
	.on([playerOpened, playerOpening], openedAt => openedAt ?? performance.now())
	.reset(playerClosed)

export const $playerExpanded = createStore(false)
	.on(playerOpened, () => true)
	.on(playerExpanded, () => true)
	.on(playerMinimized, () => false)
	.reset(playerClosed)
