
type CanPlayType = (type: string) => CanPlayTypeResult

const MATROSKA = ['video/x-matroska', 'video/matroska']

export function canDirectPlay(mimeCodec: string | null | undefined, canPlayType: CanPlayType): boolean {
	if (!mimeCodec) {
		return false
	}

	if (canPlayType(mimeCodec) === 'probably') {
		return true
	}

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
