import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { episodeFor, episodeOrder, groupTitleFiles, indexEpisodes } from './episodes'

export interface UpNext {
	file: LibraryFile
	episode: MediaEpisode | undefined
	seasonal: boolean
}

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
