import { createEffect, createEvent, createStore, merge, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { translate } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'

import { $playerMode, playbackModel, playerClosed, playerOpened, playerOpening } from '@entities/playback'
import { chooseTorrentStreamFileFx, fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
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
// A file of the playing stream's torrent picked by hand, when the node's own pick was not the one wanted.
export const streamFileChosen = createEvent<{ id: number; fileId: number }>()
// Why the pick could not be played; the player stays on the file it had.
export const streamFileRefused = createEvent<string>()
const streamFailed = createEvent<string>()

export const $streamTarget = createStore<StreamTarget | null>(null)
	.on(streamRequested, (_, target) => target)
	.reset(streamCancelled, streamPlaying)

// What the playing stream was asked for, which a file picked by hand starts over from.
export const $playingTarget = createStore<StreamTarget | null>(null)
	.on(streamRequested, (_, target) => target)
	.reset(streamCancelled)

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

const chooseFx = createEffect((pick: { id: number; fileId: number }) => chooseTorrentStreamFileFx(pick))

sample({ clock: streamRequested, target: startFx })

sample({ clock: streamFileChosen, target: chooseFx })

// The picked file is a stream of its own. Ready, the player opens it afresh; still
// being fetched, the preparing view takes over and asks until it is.
sample({
	clock: chooseFx.doneData,
	filter: stream => stream.state === 'ready' && Boolean(stream.file_id),
	fn: stream => stream.file_id as number,
	target: streamPlaying
})

const readying = sample({
	clock: chooseFx.doneData,
	source: $playingTarget,
	filter: (target, stream) =>
		target !== null && (stream.state === 'preparing' || stream.state === 'queued'),
	fn: (target, stream) => ({ target: target as StreamTarget, stream })
})

$streamTarget.on(readying, (_, { target }) => target)
$stream.on(readying, (_, { stream }) => stream)

sample({ clock: readying, fn: () => undefined, target: playerClosed })

sample({
	clock: readying,
	fn: ({ target, stream }) => ({ key: target.key, id: stream.id }),
	target: pollFx
})

sample({
	clock: chooseFx.doneData,
	filter: stream => stream.state === 'failed',
	fn: stream => stream.error || translate('torrents.stream.failed'),
	target: streamFileRefused
})

sample({
	clock: chooseFx.failData,
	fn: error => problemDetail(HttpRequestError.fromUnknown(error), translate('torrents.stream.failed')),
	target: streamFileRefused
})

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
