import type { MediaTrailer } from '@entities/media'

// The page on YouTube itself — where a trailer whose author forbids embedding
// can still be watched.
export function youtubeUrl(trailer: MediaTrailer | null | undefined): string | null {
	return trailer?.site === 'youtube' && trailer.id
		? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.id)}`
		: null
}
