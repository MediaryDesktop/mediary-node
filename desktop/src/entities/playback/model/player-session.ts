import { createEvent, createStore } from 'effector'

export const playerOpened = createEvent<number>()
export const playerOpening = createEvent()
export const playerClosed = createEvent()
export const playerMinimized = createEvent()
export const playerExpanded = createEvent()

// The player has moved to the always-on-top window; the page shows none.
export const playerPinned = createEvent()
export const playerUnpinned = createEvent()

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

export const $playerPinned = createStore(false)
	.on(playerPinned, () => true)
	.on(playerUnpinned, () => false)
	.reset(playerClosed, playerOpened)
