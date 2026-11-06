import { createEvent, createStore } from 'effector'

import { readStored, writeStored } from '@shared/lib'

export type PlayerMode = 'builtin' | 'external'

export const PLAYER_MODES: readonly PlayerMode[] = ['builtin', 'external']

const STORAGE_KEY = 'mediary.playerMode'

function readPlayerMode(): PlayerMode {
	return readStored(STORAGE_KEY) === 'external' ? 'external' : 'builtin'
}

export const playerModeChanged = createEvent<PlayerMode>()

export const $playerMode = createStore<PlayerMode>(readPlayerMode()).on(playerModeChanged, (_, mode) => mode)

$playerMode.updates.watch(mode => writeStored(STORAGE_KEY, mode))
