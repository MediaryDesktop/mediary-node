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

// A TMDB series: its episodes are numbered within seasons, not from one.
export function isSeasonalRef(mediaRef: string): boolean {
	return mediaRef.startsWith('tmdb:tv:')
}
