import type { PlaybackStream } from '../api/api'

import { canDirectPlay } from './codecs'

export type VideoSource = { kind: 'direct' } | { kind: 'hls'; path: string }

type CanPlayType = Parameters<typeof canDirectPlay>[1]

// How to play a stream, best first: the file itself when the browser can decode
// it, else the node's HLS transcode. Once direct play has failed for this file,
// it is not tried again. Null when neither is possible — the file needs a
// transcode the node cannot make, and can only be opened in another player.
export function chooseSource(
	stream: Pick<PlaybackStream, 'info' | 'hls_url'>,
	{ directFailed, canPlayType }: { directFailed: boolean; canPlayType: CanPlayType }
): VideoSource | null {
	if (!directFailed && canDirectPlay(stream.info.mime_codec, canPlayType)) {
		return { kind: 'direct' }
	}

	return stream.hls_url ? { kind: 'hls', path: stream.hls_url } : null
}

// Whether a failed direct play has somewhere to fall back to.
export function canFallBack(source: VideoSource, stream: Pick<PlaybackStream, 'hls_url'>): boolean {
	return source.kind === 'direct' && Boolean(stream.hls_url)
}
