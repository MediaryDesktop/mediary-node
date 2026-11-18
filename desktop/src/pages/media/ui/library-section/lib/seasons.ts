import { fileSeason } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

export function seasonsOf(files: LibraryFile[]): [number, LibraryFile[]][] {
	const seasons: [number, LibraryFile[]][] = []

	for (const file of files) {
		const season = fileSeason(file) ?? 1
		const last = seasons.at(-1)

		if (last && last[0] === season) {
			last[1].push(file)
		} else {
			seasons.push([season, [file]])
		}
	}

	return seasons
}
