import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { episodeFor, episodeOrder, groupTitleFiles, indexEpisodes } from './episodes'

export interface UpNext {
	file: LibraryFile
	episode: MediaEpisode | undefined
	seasonal: boolean
}

// The episode right after the user's progress, when the library has it. A later
// one does not count: "continue" from episode 3 to episode 7 skips what the user
// has not seen. A movie, which has no number, is next until it is watched.
export function upNext(
	mediaRef: string,
	files: LibraryFile[],
	episodes: MediaEpisode[],
	progress: number
): UpNext | null {
	const meta = indexEpisodes(episodes)
	const order = episodeOrder(meta)
	const own = files.filter(file => file.match?.media_ref === mediaRef)

	const file = groupTitleFiles(own, progress, order).toWatch[0]
	if (!file) {
		return null
	}

	const position = order(file)
	if (position !== null && position !== progress + 1) {
		return null
	}

	return { file, episode: episodeFor(meta, file), seasonal: meta.seasonal }
}
