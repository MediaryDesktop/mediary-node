import { createEvent, createStore } from 'effector'

export type PlayerMode = 'builtin' | 'external'

export const PLAYER_MODES: readonly PlayerMode[] = ['builtin', 'external']

const STORAGE_KEY = 'mediary.playerMode'

// Built-in by default: it needs nothing installed, while mpv has to be on PATH.
function readPlayerMode(): PlayerMode {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === 'external' ? 'external' : 'builtin'
	} catch {
		return 'builtin'
	}
}

export const playerModeChanged = createEvent<PlayerMode>()

export const $playerMode = createStore<PlayerMode>(readPlayerMode()).on(playerModeChanged, (_, mode) => mode)

$playerMode.updates.watch(mode => {
	try {
		window.localStorage.setItem(STORAGE_KEY, mode)
	} catch {}
})
