const VIDEO_TYPES = new Set(['anime', 'movie', 'series', 'dorama'])

// Watched as video: what the player, streaming and episode counts are for.
export function isVideoMedia(mediaType: string): boolean {
	return VIDEO_TYPES.has(mediaType)
}

// Read rather than watched: chapters and pages instead of episodes, authors
// instead of studios, no torrents and no trailer.
export function isReadMedia(mediaType: string): boolean {
	return mediaType === 'manga' || mediaType === 'book'
}
