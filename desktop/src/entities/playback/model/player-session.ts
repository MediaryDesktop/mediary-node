import { createEvent, createStore } from 'effector'

// The file the built-in player is showing. Kept here rather than on a page, so the
// player stays open across route changes and sits over whatever page is behind it.
export const playerOpened = createEvent<number>()
export const playerClosed = createEvent()
export const playerMinimized = createEvent()
export const playerExpanded = createEvent()

export const $playerFileId = createStore<number | null>(null)
	.on(playerOpened, (_, fileId) => fileId)
	.reset(playerClosed)

// Whether the player fills the window or sits in the corner.
export const $playerExpanded = createStore(false)
	.on(playerOpened, () => true)
	.on(playerExpanded, () => true)
	.on(playerMinimized, () => false)
	.reset(playerClosed)
