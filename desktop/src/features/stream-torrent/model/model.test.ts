import { allSettled, fork, scopeBind } from 'effector'
import type { Scope } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { $playerFileId } from '@entities/playback'
import { chooseTorrentStreamFileFx, fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
import type { TorrentStream } from '@entities/torrent'

import {
	$stream,
	$streamError,
	$streamTarget,
	pollPauseFx,
	streamCancelled,
	streamFileChosen,
	streamFileRefused,
	streamRequested
} from './model'
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

	describe('a file picked by hand while playing', () => {
		const files = [
			{ id: 0, path: 'Frieren/Frieren - 01.mkv', size: 300 },
			{ id: 1, path: 'Frieren/Frieren - 02.mkv', size: 310 }
		]
		const playing = stream({ state: 'ready', progress: 1, file_id: -3, files })

		it('opens the new file afresh once it is ready', async () => {
			const choose = vi.fn(() =>
				Promise.resolve(stream({ id: 4, state: 'ready', progress: 1, file_id: -4 }))
			)
			const scope = fork({
				handlers: [
					[startTorrentStreamFx, () => Promise.resolve(playing)],
					[chooseTorrentStreamFileFx, choose]
				]
			})

			await allSettled(streamRequested, { scope, params: TARGET })
			expect(scope.getState($playerFileId)).toBe(-3)

			await allSettled(streamFileChosen, { scope, params: { id: 3, fileId: 1 } })

			expect(choose).toHaveBeenCalledWith({ id: 3, fileId: 1 })
			expect(scope.getState($playerFileId)).toBe(-4)
		})

		it('goes back to preparing while the file is fetched, and plays it when it is', async () => {
			const fetched = vi.fn(() =>
				Promise.resolve(stream({ id: 4, state: 'ready', progress: 1, file_id: -4 }))
			)
			const scope = fork({
				handlers: [
					[startTorrentStreamFx, () => Promise.resolve(playing)],
					[chooseTorrentStreamFileFx, () => Promise.resolve(stream({ id: 4, progress: 0.2 }))],
					[fetchTorrentStreamFx, fetched],
					[pollPauseFx, () => Promise.resolve()]
				]
			})

			await allSettled(streamRequested, { scope, params: TARGET })
			await allSettled(streamFileChosen, { scope, params: { id: 3, fileId: 1 } })

			expect(fetched).toHaveBeenCalledWith(4)
			expect(scope.getState($playerFileId)).toBe(-4)
		})

		it('says why a pick was refused and leaves the player on its file', async () => {
			const refused: string[] = []
			const scope = fork({
				handlers: [
					[startTorrentStreamFx, () => Promise.resolve(playing)],
					[chooseTorrentStreamFileFx, () => Promise.reject(new Error('the torrent has no file 7'))]
				]
			})
			const stop = streamFileRefused.watch(message => refused.push(message))

			await allSettled(streamRequested, { scope, params: TARGET })
			await allSettled(streamFileChosen, { scope, params: { id: 3, fileId: 7 } })

			stop()

			expect(refused).toHaveLength(1)
			expect(scope.getState($playerFileId)).toBe(-3)
		})

		it('treats a pick the node gave up on as refused too', async () => {
			const refused: string[] = []
			const scope = fork({
				handlers: [
					[startTorrentStreamFx, () => Promise.resolve(playing)],
					[
						chooseTorrentStreamFileFx,
						() => Promise.resolve(stream({ id: 4, state: 'failed', error: 'no seeds' }))
					]
				]
			})
			const stop = streamFileRefused.watch(message => refused.push(message))

			await allSettled(streamRequested, { scope, params: TARGET })
			await allSettled(streamFileChosen, { scope, params: { id: 3, fileId: 1 } })

			stop()

			expect(refused).toEqual(['no seeds'])
			expect(scope.getState($playerFileId)).toBe(-3)
		})
	})
})
