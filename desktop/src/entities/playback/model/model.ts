import { createMutation, createQuery } from '@farfetched/core'
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

const playbackEvent = nodeTopic('playback')

export const playbackQuery = createQuery({ effect: fetchPlaybackFx, name: 'playback' })

export const startPlaybackMutation = createMutation({ effect: startPlaybackFx, name: 'startPlayback' })

export const controlPlaybackMutation = createMutation({
	effect: controlPlaybackFx,
	name: 'controlPlayback'
})

export const stopPlaybackMutation = createMutation({ effect: stopPlaybackFx, name: 'stopPlayback' })

export const playbackStreamQuery = createQuery({ effect: fetchPlaybackStreamFx, name: 'playbackStream' })

function numberIn(payload: Record<string, unknown> | undefined, key: string): number {
	const value = payload?.[key]

	return typeof value === 'number' ? value : 0
}

function flagIn(payload: Record<string, unknown> | undefined, key: string): boolean {
	return payload?.[key] === true
}

export const playbackModel = atom(() => {
	// The node reports the position several times a minute over the socket, so the
	// session here follows those events; the query only supplies the starting point
	// after the window is reopened.
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

	// The built-in player reports and forgets: a report that fails is followed by
	// another a few seconds later, and the node keeps the rule about when to count.
	const progressReported = createEvent<ReportProgressParams>()

	sample({ clock: progressReported, target: reportPlaybackProgressFx })

	// Encoders would otherwise run until the node's idle reaper notices.
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
