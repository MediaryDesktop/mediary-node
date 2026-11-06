import { allSettled, fork, scopeBind } from 'effector'
import type { Scope } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { $playerFileId } from '@entities/playback'
import { fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
import type { TorrentStream } from '@entities/torrent'

import { $stream, $streamError, $streamTarget, pollPauseFx, streamCancelled, streamRequested } from './model'
import type { StreamTarget } from './model'

const TARGET: StreamTarget = {
	key: 'anilist:1/:5',
	label: 'Frieren · Episode 5',
	params: { media_ref: 'anilist:1', title: 'Frieren', episode: 5, auto: true }
}

function stream(fields: Partial<TorrentStream>): TorrentStream {
	return {
		id: 3,
		state: 'preparing',
		via: 'debrid',
		service: 'TorBox',
		progress: 0,
		speed: 0,
		media_ref: 'anilist:1',
		...fields
	}
}

const ready = stream({ state: 'ready', progress: 1, file_id: -3 })

describe('torrent stream', () => {
	it('opens the built-in player once the service has the file', async () => {
		const scope = fork({
			handlers: [[startTorrentStreamFx, () => Promise.resolve(ready)]]
		})

		await allSettled(streamRequested, { scope, params: TARGET })

		expect(scope.getState($playerFileId)).toBe(-3)
		expect(scope.getState($streamTarget)).toBeNull()
	})

	it('asks again while the service gets the torrent', async () => {
		const answers = [stream({ progress: 0.5 }), ready]
		const fetched = vi.fn(() => Promise.resolve(answers.shift()!))

		const scope = fork({
			handlers: [
				[startTorrentStreamFx, () => Promise.resolve(stream({ progress: 0.1 }))],
				[fetchTorrentStreamFx, fetched],
				[pollPauseFx, () => Promise.resolve()]
			]
		})

		await allSettled(streamRequested, { scope, params: TARGET })

		expect(fetched).toHaveBeenCalledTimes(2)
		expect(scope.getState($playerFileId)).toBe(-3)
	})

	it('ignores what comes after the stream was cancelled', async () => {
		const scope: Scope = fork({
			handlers: [
				[
					startTorrentStreamFx,
					() => {
						scopeBind(streamCancelled, { scope })()
						return Promise.resolve(ready)
					}
				]
			]
		})

		await allSettled(streamRequested, { scope, params: TARGET })

		expect(scope.getState($playerFileId)).toBeNull()
		expect(scope.getState($streamTarget)).toBeNull()
	})

	it('gives up when the service did', async () => {
		const scope = fork({
			handlers: [
				[
					startTorrentStreamFx,
					() => Promise.resolve(stream({ state: 'failed', error: 'TorBox: no seeds' }))
				]
			]
		})

		await allSettled(streamRequested, { scope, params: TARGET })

		expect(scope.getState($streamTarget)).toEqual(TARGET)
		expect(scope.getState($streamError)).toBe('TorBox: no seeds')
		expect(scope.getState($stream)?.state).toBe('failed')
		expect(scope.getState($playerFileId)).toBeNull()

		await allSettled(streamCancelled, { scope })

		expect(scope.getState($streamTarget)).toBeNull()
		expect(scope.getState($streamError)).toBeNull()
	})
})
