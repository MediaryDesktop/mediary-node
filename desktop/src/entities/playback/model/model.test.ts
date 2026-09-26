import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { nodeEventReceived } from '@infra/node'

import { fetchPlaybackFx, startPlaybackFx, stopPlaybackFx } from '../api/api'
import type { PlaybackSession } from '../api/api'

import { formatTimecode, playbackModel, playbackProgress, playbackQuery } from './model'

const SESSION: PlaybackSession = {
	file_id: 7,
	path: 'D:\\Anime\\Frieren\\ep 01.mkv',
	title: 'Sousou no Frieren',
	media_ref: 'anilist:154587',
	episode: 1,
	position: 0,
	duration: 0,
	paused: false,
	watched: false,
	started_at: '2026-01-01T00:00:00Z'
}

function playbackEvent(state: string, payload: Record<string, unknown> = {}) {
	return { topic: 'playback', at: '2026-01-01T00:00:00Z', payload: { state, ...payload } }
}

describe('playback session', () => {
	it('starts from what the node reports and then follows its events', async () => {
		const scope = fork({
			handlers: [
				[startPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })]
			]
		})

		await allSettled(playbackModel.playRequested, { scope, params: SESSION.file_id })

		expect(scope.getState(playbackModel.$session)?.title).toBe(SESSION.title)

		await allSettled(nodeEventReceived, {
			scope,
			params: playbackEvent('position', { position: 610, duration: 1440, paused: false })
		})

		const session = scope.getState(playbackModel.$session)
		expect(session?.position).toBe(610)
		expect(session?.duration).toBe(1440)
	})

	it('keeps the duration it already knows when an event leaves it out', async () => {
		const scope = fork({
			handlers: [
				[startPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })]
			]
		})

		await allSettled(playbackModel.playRequested, { scope, params: SESSION.file_id })
		await allSettled(nodeEventReceived, {
			scope,
			params: playbackEvent('position', { position: 60, duration: 1440 })
		})
		await allSettled(nodeEventReceived, { scope, params: playbackEvent('paused', { paused: true }) })

		const session = scope.getState(playbackModel.$session)
		expect(session?.duration).toBe(1440)
		expect(session?.paused).toBe(true)
	})

	it('remembers that the episode was counted as watched', async () => {
		const scope = fork({
			handlers: [
				[startPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })]
			]
		})

		await allSettled(playbackModel.playRequested, { scope, params: SESSION.file_id })
		await allSettled(nodeEventReceived, { scope, params: playbackEvent('watched', { watched: true }) })

		expect(scope.getState(playbackModel.$session)?.watched).toBe(true)
	})

	it('clears the session when the player closes', async () => {
		const scope = fork({
			handlers: [
				[startPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })]
			]
		})

		await allSettled(playbackModel.playRequested, { scope, params: SESSION.file_id })
		await allSettled(nodeEventReceived, { scope, params: playbackEvent('ended') })

		expect(scope.getState(playbackModel.$session)).toBeNull()
	})

	it('asks the node again after stopping, so the bar never lingers', async () => {
		const status = vi.fn().mockResolvedValue({ playback: { playing: false } })

		const scope = fork({
			handlers: [
				[startPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })],
				[stopPlaybackFx, () => Promise.resolve({ playback: { playing: false } })],
				[fetchPlaybackFx, status]
			]
		})

		await allSettled(playbackModel.playRequested, { scope, params: SESSION.file_id })
		await allSettled(playbackModel.stopRequested, { scope })

		expect(scope.getState(playbackModel.$session)).toBeNull()
		expect(status).toHaveBeenCalled()
	})

	it('picks up a session that was already running when the window opened', async () => {
		const scope = fork({
			handlers: [
				[fetchPlaybackFx, () => Promise.resolve({ playback: { playing: true, session: SESSION } })]
			]
		})

		await allSettled(playbackQuery.start, { scope })

		expect(scope.getState(playbackModel.$session)?.file_id).toBe(SESSION.file_id)
	})
})

describe('playbackProgress', () => {
	it('is zero until the duration is known', () => {
		expect(playbackProgress({ ...SESSION, position: 120 })).toBe(0)
		expect(playbackProgress(null)).toBe(0)
	})

	it('is the share of the file that was played', () => {
		expect(playbackProgress({ ...SESSION, position: 720, duration: 1440 })).toBe(0.5)
	})
})

describe('formatTimecode', () => {
	it('reads as a timecode', () => {
		expect(formatTimecode(0)).toBe('0:00')
		expect(formatTimecode(65)).toBe('1:05')
		expect(formatTimecode(3725)).toBe('1:02:05')
	})

	it('survives what the player has not reported yet', () => {
		expect(formatTimecode(Number.NaN)).toBe('0:00')
		expect(formatTimecode(-5)).toBe('0:00')
	})
})
