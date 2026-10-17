import { createEvent, createStore } from 'effector'

// The file the built-in player is showing. Kept here rather than on a page, so the
// player stays open across route changes and sits over whatever page is behind it.
export const playerOpened = createEvent<number>()
// The player slides up before it has a file: a stream asked for opens it at once
// to show how far it is, and the file it then plays carries on the same slide.
export const playerOpening = createEvent()
export const playerClosed = createEvent()
export const playerMinimized = createEvent()
export const playerExpanded = createEvent()

export const $playerFileId = createStore<number | null>(null)
	.on(playerOpened, (_, fileId) => fileId)
	.reset(playerClosed)

// When the player slid up to open. The loading panel and then the player take turns
// showing it, and each one continues this one slide rather than starting its own;
// another file opened while it is already up keeps it.
export const $playerOpenedAt = createStore<number | null>(null)
	.on([playerOpened, playerOpening], openedAt => openedAt ?? performance.now())
	.reset(playerClosed)

// Whether the player fills the window or sits in the corner.
export const $playerExpanded = createStore(false)
	.on(playerOpened, () => true)
	.on(playerExpanded, () => true)
	.on(playerMinimized, () => false)
	.reset(playerClosed)
