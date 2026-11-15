import { createEffect, createEvent, createStore, merge, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { translate } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'

import { $playerMode, playbackModel, playerClosed, playerOpened, playerOpening } from '@entities/playback'
import { fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
import type { StartTorrentStreamParams, TorrentStream } from '@entities/torrent'

const POLL_MS = 2000

export interface StreamTarget {
	key: string
	label: string
	params: StartTorrentStreamParams
}

export type StreamVia = NonNullable<StartTorrentStreamParams['via']>

const VIA_KEY = 'mediary.stream.via'

export const streamViaChanged = createEvent<StreamVia>()

export const $streamVia = createStore<StreamVia>(
	readStored(VIA_KEY) === 'embedded' ? 'embedded' : 'debrid'
).on(streamViaChanged, (_, via) => via)

streamViaChanged.watch(via => writeStored(VIA_KEY, via))

const AUTO_SELECT_KEY = 'mediary.stream.autoSelect'

// Whether "play" picks a release by itself or opens the search to choose one.
export const autoSelectChanged = createEvent<boolean>()

export const $autoSelect = createStore(readStored(AUTO_SELECT_KEY) !== 'off').on(
	autoSelectChanged,
	(_, on) => on
)

autoSelectChanged.watch(on => writeStored(AUTO_SELECT_KEY, on ? 'on' : 'off'))

export const streamRequested = createEvent<StreamTarget>()
export const streamCancelled = createEvent()
export const streamPlaying = createEvent<number>()
const streamFailed = createEvent<string>()

export const $streamTarget = createStore<StreamTarget | null>(null)
	.on(streamRequested, (_, target) => target)
	.reset(streamCancelled, streamPlaying)

export const $stream = createStore<TorrentStream | null>(null).reset(
	streamRequested,
	streamCancelled,
	streamPlaying
)

export const $streamError = createStore<string | null>(null)
	.on(streamFailed, (_, message) => message)
	.reset(streamRequested, streamCancelled, streamPlaying)

interface Answer {
	key: string
	stream: TorrentStream
}

const startFx = createEffect(async (target: StreamTarget): Promise<Answer> => ({
	key: target.key,
	stream: await startTorrentStreamFx(target.params)
}))

export const pollPauseFx = createEffect(
	() => new Promise<void>(resolve => window.setTimeout(resolve, POLL_MS))
)

const pollFx = createEffect(async ({ key, id }: { key: string; id: number }): Promise<Answer> => {
	await pollPauseFx()
	return { key, stream: await fetchTorrentStreamFx(id) }
})

sample({ clock: streamRequested, target: startFx })

sample({ clock: streamRequested, target: playerOpening })

const current = sample({
	clock: merge([startFx.doneData, pollFx.doneData]),
	source: $streamTarget,
	filter: (target, answer) => target?.key === answer.key,
	fn: (_, answer) => answer.stream
})

const waiting = sample({
	clock: current,
	filter: stream => stream.state === 'preparing' || stream.state === 'queued'
})

sample({ clock: current, filter: stream => stream.state !== 'ready', target: $stream })

sample({
	clock: waiting,
	source: $streamTarget,
	filter: Boolean,
	fn: (target, stream) => ({ key: target.key, id: stream.id }),
	target: pollFx
})

sample({
	clock: current,
	filter: stream => stream.state === 'ready' && Boolean(stream.file_id),
	fn: stream => stream.file_id as number,
	target: streamPlaying
})

sample({
	clock: current,
	filter: stream => stream.state === 'failed',
	fn: stream => stream.error || translate('torrents.stream.failed'),
	target: streamFailed
})

sample({
	clock: [
		startFx.fail.map(({ params, error }) => ({ key: params.key, error })),
		pollFx.fail.map(({ params, error }) => ({ key: params.key, error }))
	],
	source: $streamTarget,
	filter: (target, failure) => target?.key === failure.key,
	fn: (_, failure) =>
		problemDetail(HttpRequestError.fromUnknown(failure.error), translate('torrents.stream.failed')),
	target: streamFailed
})

sample({
	clock: streamPlaying,
	source: $playerMode,
	filter: mode => mode === 'external',
	fn: (_, fileId) => fileId,
	target: playbackModel.playRequested
})

sample({
	clock: streamPlaying,
	source: $playerMode,
	filter: mode => mode === 'external',
	target: playerClosed
})

sample({
	clock: streamPlaying,
	source: $playerMode,
	filter: mode => mode !== 'external',
	fn: (_, fileId) => fileId,
	target: playerOpened
})
