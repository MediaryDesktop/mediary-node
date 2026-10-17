import { createEffect, createEvent, createStore, merge, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { translate } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'

import { $playerMode, playbackModel, playerClosed, playerOpened, playerOpening } from '@entities/playback'
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

// What a stream comes through: the debrid service set up, or the node's own
// client, which downloads the file's start first and plays it as it comes.
export type StreamVia = NonNullable<StartTorrentStreamParams['via']>

const VIA_KEY = 'mediary.stream.via'

export const streamViaChanged = createEvent<StreamVia>()

// The choice as last made on this computer; without a debrid service only the
// built-in client is there, whatever this says.
export const $streamVia = createStore<StreamVia>(
	readStored(VIA_KEY) === 'embedded' ? 'embedded' : 'debrid'
).on(streamViaChanged, (_, via) => via)

streamViaChanged.watch(via => writeStored(VIA_KEY, via))

export const streamRequested = createEvent<StreamTarget>()
export const streamCancelled = createEvent()
// The player opened on a ready stream, with the stream's file ID.
export const streamPlaying = createEvent<number>()
const streamFailed = createEvent<string>()

// What is being readied. A failure keeps it, so the player stays open on what
// went wrong until the user closes it.
export const $streamTarget = createStore<StreamTarget | null>(null)
	.on(streamRequested, (_, target) => target)
	.reset(streamCancelled, streamPlaying)

// The node's last answer, failed ones too, so the candidates it gave up on stay
// shown; null until it first answers. The player shows this in place of the picture.
export const $stream = createStore<TorrentStream | null>(null).reset(
	streamRequested,
	streamCancelled,
	streamPlaying
)

// Set when the service or the built-in client gave up; the player shows this in
// place of the picture, rather than a toast the player itself would sit under.
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

// The pause between two questions about a stream; a test answers it at once.
export const pollPauseFx = createEffect(
	() => new Promise<void>(resolve => window.setTimeout(resolve, POLL_MS))
)

const pollFx = createEffect(async ({ key, id }: { key: string; id: number }): Promise<Answer> => {
	await pollPauseFx()
	return { key, stream: await fetchTorrentStreamFx(id) }
})

sample({ clock: streamRequested, target: startFx })

// The player slides up at once, as it does for a file, and shows the stream readied.
sample({ clock: streamRequested, target: playerOpening })

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

// The player the settings name: the built-in one, or mpv.
sample({
	clock: streamPlaying,
	source: $playerMode,
	filter: mode => mode === 'external',
	fn: (_, fileId) => fileId,
	target: playbackModel.playRequested
})

// mpv takes it from here: the built-in player that showed the stream readied closes,
// and the next one opened slides up afresh.
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
