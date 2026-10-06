import type { TorrentFile } from '@entities/torrent'

// Which files start ticked. For a torrent held for the choice: every video whose
// episode the library does not have yet, and the rest of the files — subtitles,
// fonts — as they come. Afterwards: what the client is downloading.
export function initialSelection(files: TorrentFile[], owned: Set<number>, choosing: boolean): Set<number> {
	if (!choosing) {
		return new Set(files.filter(file => file.selected).map(file => file.index))
	}

	return new Set(
		files
			.filter(file => !(file.video && file.episode !== undefined && owned.has(file.episode)))
			.map(file => file.index)
	)
}

// Files in the order a person reads a season: by episode, then by name.
export function sortFiles(files: TorrentFile[]): TorrentFile[] {
	return [...files].sort((left, right) => {
		const a = left.episode ?? Number.POSITIVE_INFINITY
		const b = right.episode ?? Number.POSITIVE_INFINITY

		return a !== b ? a - b : left.name.localeCompare(right.name, undefined, { numeric: true })
	})
}
