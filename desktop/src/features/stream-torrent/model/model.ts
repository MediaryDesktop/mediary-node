import { createEffect, createEvent, createStore, merge, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { $playerMode, playbackModel, playerOpened } from '@entities/playback'
import { fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
import type { StartTorrentStreamParams, TorrentStream } from '@entities/torrent'

// How often a stream the service is still getting is asked about.
const POLL_MS = 2000

// What is being readied to play: a release from the search, or an episode the
// node picks a release for. The key tells the two apart and says which card is
// busy; the label names it in the overlay.
export interface StreamTarget {
	key: string
	label: string
	params: StartTorrentStreamParams
}

export const streamRequested = createEvent<StreamTarget>()
export const streamCancelled = createEvent()
// The player opened on a ready stream, with the stream's file ID.
export const streamPlaying = createEvent<number>()
const streamFailed = createEvent<string>()

export const $streamTarget = createStore<StreamTarget | null>(null)
	.on(streamRequested, (_, target) => target)
	.reset(streamCancelled, streamPlaying, streamFailed)

// How far the service is; null until it first answers.
export const $stream = createStore<TorrentStream | null>(null).reset(
	streamRequested,
	streamCancelled,
	streamPlaying,
	streamFailed
)

interface Answer {
	key: string
	stream: TorrentStream
}

const startFx = createEffect(async (target: StreamTarget): Promise<Answer> => ({
	key: target.key,
	stream: await startTorrentStreamFx(target.params)
}))

// The pause between two questions about a stream; a test answers it at once.
export const pollPauseFx = createEffect(
	() => new Promise<void>(resolve => window.setTimeout(resolve, POLL_MS))
)

const pollFx = createEffect(async ({ key, id }: { key: string; id: number }): Promise<Answer> => {
	await pollPauseFx()
	return { key, stream: await fetchTorrentStreamFx(id) }
})

sample({ clock: streamRequested, target: startFx })

// An answer counts only for the stream still wanted: one cancelled, or replaced
// by another, may still be answered after.
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

sample({ clock: waiting, target: $stream })

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

// The player the settings name: the built-in one, or mpv.
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
	filter: mode => mode !== 'external',
	fn: (_, fileId) => fileId,
	target: playerOpened
})

streamFailed.watch(message => toast.error(message, { id: 'torrent-stream' }))
