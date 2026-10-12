import type { LibraryFile } from '@entities/library-item'

import { episodeSeason } from '@features/continue-watching'

// Files in season order, already sorted, split where the season changes. A file
// without a season counts as the first.
export function seasonsOf(files: LibraryFile[]): [number, LibraryFile[]][] {
	const seasons: [number, LibraryFile[]][] = []

	for (const file of files) {
		const season = episodeSeason(file) ?? 1
		const last = seasons.at(-1)

		if (last && last[0] === season) {
			last[1].push(file)
		} else {
			seasons.push([season, [file]])
		}
	}

	return seasons
}
