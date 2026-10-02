// Adapted from Seanime (github.com/5rahim/seanime, video-core/_lib/codec-utils.ts),
// GPL-3.0.

type CanPlayType = (type: string) => CanPlayTypeResult

const MATROSKA = ['video/x-matroska', 'video/matroska']

// Chromium is the only judge of what it can decode, so the node describes the file
// and the renderer asks. "maybe" is not enough: it means the container is known,
// not that these codecs will play.
export function canDirectPlay(mimeCodec: string | null | undefined, canPlayType: CanPlayType): boolean {
	if (!mimeCodec) {
		return false
	}

	if (canPlayType(mimeCodec) === 'probably') {
		return true
	}

	// Chromium plays Matroska but answers canPlayType for it with "". The codecs
	// are what decide, so ask again as if they sat in a container it admits to.
	const container = MATROSKA.find(type => mimeCodec.startsWith(type))
	if (!container) {
		return false
	}

	const rest = mimeCodec.slice(container.length)

	return canPlayType(`video/mp4${rest}`) === 'probably' || canPlayType(`video/webm${rest}`) === 'probably'
}

export function browserCanPlayType(type: string): CanPlayTypeResult {
	return document.createElement('video').canPlayType(type)
}
