import type { MediaDetails } from '@entities/media'
import type { TrackerEntry } from '@entities/tracker'

export type MediaBase = NonNullable<MediaDetails | TrackerEntry['media']>

export interface MediaViewSubject {
	base: MediaBase
	mediaType: string
	total: number | null | undefined
}

export function resolveSubject(
	media: MediaDetails | null,
	entry: TrackerEntry | null
): MediaViewSubject | null {
	const base = media ?? entry?.media

	if (!base) {
		return null
	}

	const mediaType = media?.media_type ?? entry?.media_type ?? 'anime'

	return {
		base,
		mediaType,
		total: mediaType === 'manga' ? base.chapters : mediaType === 'book' ? base.pages : base.episodes
	}
}
