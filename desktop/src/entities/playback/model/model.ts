import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { nodeTopic } from '@infra/node'

import {
	controlPlaybackFx,
	fetchPlaybackFx,
	fetchPlaybackStreamFx,
	reportPlaybackProgressFx,
	startPlaybackFx,
	stopPlaybackFx,
	stopTranscodeFx
} from '../api/api'
import type { PlaybackSession, ReportProgressParams } from '../api/api'

import { $playerFileId, playerClosed } from './player-session'

const playbackEvent = nodeTopic('playback')

export const playbackQuery = createQuery({ effect: fetchPlaybackFx, name: 'playback' })

export const startPlaybackMutation = createMutation({ effect: startPlaybackFx, name: 'startPlayback' })

export const controlPlaybackMutation = createMutation({
	effect: controlPlaybackFx,
	name: 'controlPlayback'
})

export const stopPlaybackMutation = createMutation({ effect: stopPlaybackFx, name: 'stopPlayback' })

export const playbackStreamQuery = createQuery({ effect: fetchPlaybackStreamFx, name: 'playbackStream' })

concurrency(playbackStreamQuery, { strategy: 'TAKE_LATEST' })

// The stream's description carries where the user stopped; one kept from the
// last time the file was open would start the next play there.
sample({ clock: playerClosed, target: playbackStreamQuery.reset })

function numberIn(payload: Record<string, unknown> | undefined, key: string): number {
	const value = payload?.[key]

	return typeof value === 'number' ? value : 0
}

function flagIn(payload: Record<string, unknown> | undefined, key: string): boolean {
	return payload?.[key] === true
}

export const playbackModel = atom(() => {
	const $session = createStore<PlaybackSession | null>(null)
		.on(playbackQuery.finished.success, (_, { result }) => result.playback.session ?? null)
		.on(startPlaybackMutation.finished.success, (_, { result }) => result.playback.session ?? null)
		.on(controlPlaybackMutation.finished.success, (_, { result }) => result.playback.session ?? null)
		.on(playbackEvent, (current, event) => {
			const state = event.payload?.state

			if (state === 'ended') {
				return null
			}
			if (!current) {
				return current
			}

			return {
				...current,
				position: numberIn(event.payload, 'position'),
				duration: numberIn(event.payload, 'duration') || current.duration,
				paused: flagIn(event.payload, 'paused'),
				watched: flagIn(event.payload, 'watched') || current.watched
			}
		})
		.reset(stopPlaybackMutation.finished.success)

	sample({ clock: stopPlaybackMutation.finished.success, target: playbackQuery.start })

	const progressReported = createEvent<ReportProgressParams>()

	sample({ clock: progressReported, target: reportPlaybackProgressFx })

	// The built-in player's last word, once the node has it: its report as it
	// closes, when no player is open any more. What the page shows of where the
	// user stopped can be read again then.
	const progressSettled = sample({
		clock: reportPlaybackProgressFx.done,
		source: $playerFileId,
		filter: open => open === null,
		fn: () => undefined
	})

	const transcodeClosed = createEvent<number>()

	sample({ clock: transcodeClosed, target: stopTranscodeFx })

	return {
		$session,
		$starting: startPlaybackMutation.$pending,
		playRequested: startPlaybackMutation.start,
		stopRequested: stopPlaybackMutation.start,
		commandRequested: controlPlaybackMutation.start,
		playFailed: startPlaybackMutation.finished.failure,
		watched: playbackEvent.filter({ fn: event => event.payload?.state === 'watched' }),
		progressReported,
		progressSettled,
		transcodeClosed
	}
})

export function playbackProgress(session: PlaybackSession | null): number {
	if (!session || session.duration <= 0) {
		return 0
	}

	return Math.min(Math.max(session.position / session.duration, 0), 1)
}

export function formatTimecode(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00'
	}

	const whole = Math.floor(seconds)
	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const rest = whole % 60

	const padded = `${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}:${rest.toString().padStart(2, '0')}`

	return hours > 0 ? `${hours}:${padded}` : padded
}
