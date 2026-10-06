import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { $nodeReady } from '@infra/node'

import { titleFilesQuery } from '@entities/library-item'
import { torrentDownloadsQuery } from '@entities/torrent'

import { missingEpisodes } from './episodes'

// The title's episodes out so far that the library lacks and no download brings.
// Null when the title's episode count is not known.
export function useMissingEpisodes(mediaRef: string, released: number | null): number[] | null {
	const [files, loadFiles, downloads, nodeReady] = useUnit([
		titleFilesQuery.$data,
		titleFilesQuery.start,
		torrentDownloadsQuery.$data,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			loadFiles({ mediaRef, kind: 'video' })
		}
	}, [loadFiles, mediaRef, nodeReady])

	return useMemo(() => {
		const have: number[] = []

		for (const file of files?.files.items ?? []) {
			const episode =
				file.match?.media_ref === mediaRef ? (file.match.episode ?? file.parsed.episode) : null
			if (!file.missing && episode != null) {
				have.push(episode)
			}
		}

		for (const download of downloads?.downloads ?? []) {
			if (download.media_ref === mediaRef && download.state !== 'failed') {
				have.push(...(download.episodes ?? []))
			}
		}

		return missingEpisodes(released, have)
	}, [files, downloads, mediaRef, released])
}
