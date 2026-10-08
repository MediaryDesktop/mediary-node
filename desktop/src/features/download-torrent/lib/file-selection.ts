import type { LibraryFile } from '@entities/library-item'
import type { TorrentFile } from '@entities/torrent'

// The episodes a title already has on disk, keyed so a torrent's files can be
// looked up in them. A show numbered by season keys by season and episode — its
// numbers repeat across seasons — and an anime by the episode alone.
export class OwnedEpisodes {
	private readonly keys: Set<string>

	constructor(
		private readonly seasonal: boolean,
		keys: Iterable<string> = []
	) {
		this.keys = new Set(keys)
	}

	static fromLibrary(files: LibraryFile[], seasonal: boolean): OwnedEpisodes {
		const owned = new OwnedEpisodes(seasonal)

		for (const file of files) {
			const episode = file.match?.episode ?? file.parsed.episode
			if (!file.missing && episode !== undefined && episode !== null) {
				owned.keys.add(owned.key(file.match?.season ?? file.parsed.season, episode))
			}
		}

		return owned
	}

	// A first season is often left unwritten: Show - 05.mkv.
	key(season: number | null | undefined, episode: number): string {
		return this.seasonal ? `${season ?? 1}:${episode}` : String(episode)
	}

	has(file: TorrentFile): boolean {
		return file.video && file.episode !== undefined && this.keys.has(this.key(file.season, file.episode))
	}
}

// Which files start ticked. For a torrent held for the choice: every video whose
// episode the library does not have yet, and the rest of the files — subtitles,
// fonts — as they come. Afterwards: what the client is downloading.
export function initialSelection(files: TorrentFile[], owned: OwnedEpisodes, choosing: boolean): Set<number> {
	if (!choosing) {
		return new Set(files.filter(file => file.selected).map(file => file.index))
	}

	return new Set(files.filter(file => !owned.has(file)).map(file => file.index))
}

// Files in the order a person reads a show: by season, by episode, then by name.
export function sortFiles(files: TorrentFile[]): TorrentFile[] {
	return [...files].sort((left, right) => {
		const bySeason = (left.season ?? 0) - (right.season ?? 0)
		if (bySeason !== 0) {
			return bySeason
		}

		const a = left.episode ?? Number.POSITIVE_INFINITY
		const b = right.episode ?? Number.POSITIVE_INFINITY

		return a !== b ? a - b : left.name.localeCompare(right.name, undefined, { numeric: true })
	})
}
