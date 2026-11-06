import type { LibraryFile } from '@entities/library-item'
import type { TorrentFile } from '@entities/torrent'

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

	key(season: number | null | undefined, episode: number): string {
		return this.seasonal ? `${season ?? 1}:${episode}` : String(episode)
	}

	has(file: TorrentFile): boolean {
		return file.video && file.episode !== undefined && this.keys.has(this.key(file.season, file.episode))
	}
}

export function initialSelection(files: TorrentFile[], owned: OwnedEpisodes, choosing: boolean): Set<number> {
	if (!choosing) {
		return new Set(files.filter(file => file.selected).map(file => file.index))
	}

	return new Set(files.filter(file => !owned.has(file)).map(file => file.index))
}

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
