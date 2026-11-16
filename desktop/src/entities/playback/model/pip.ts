import { createEffect, createEvent, createStore, sample } from 'effector'

import type { PipOpenOptions, PipResult, PipSnapshot } from '@shared/bridge'

import { $playerPinned, playerClosed, playerExpanded, playerPinned, playerUnpinned } from './player-session'

// Where playback stands, so a player built anew — in the pinned window, say —
// carries on from the same moment.
export type PlayerSnapshot = PipSnapshot

export const pinRequested = createEvent<PipOpenOptions>()

// The pinned window went: why, and where playback stood.
export const pipClosed = createEvent<PipResult>()

// The player built again after the pinned window gave it back has taken up the
// position it was handed.
export const pipResumeApplied = createEvent()

export const openPipFx = createEffect((options: PipOpenOptions) => window.mediary.pip.open(options))

export const dismissPipFx = createEffect(() => window.mediary.pip.dismiss())

sample({ clock: pinRequested, target: openPipFx })

sample({ clock: openPipFx.doneData, filter: Boolean, fn: () => undefined, target: playerPinned })

sample({ clock: pipClosed, fn: () => undefined, target: playerUnpinned })

export const pipStopped = sample({
	clock: pipClosed,
	filter: result => result.intent === 'stop',
	fn: () => undefined
})

sample({ clock: pipStopped, target: playerClosed })

sample({
	clock: pipClosed,
	filter: result => result.intent === 'expand',
	fn: () => undefined,
	target: playerExpanded
})

export const $pipResume = createStore<PlayerSnapshot | null>(null)
	.on(pipClosed, (_, result) =>
		result.intent === 'stop' ? null : { position: result.position, playing: result.playing }
	)
	.reset(pipResumeApplied, playerClosed)

// Whatever ends the pinned state from this side — another video, the player
// closed — takes the pinned window with it. When the window itself went, the
// call finds nothing to close and does nothing.
sample({ clock: $playerPinned.updates, filter: pinned => !pinned, target: dismissPipFx })

// The main window hears of the pinned one closing for as long as it lives, not
// only while the mini player is on screen.
export function subscribeToPip(): () => void {
	return window.mediary.pip.onClosed(result => pipClosed(result))
}
