import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'

import { seasonsOf } from './seasons'

function file(id: number, season: number | null): LibraryFile {
	return { id, match: null, parsed: { season } } as unknown as LibraryFile
}

describe('seasonsOf', () => {
	it('splits sorted files where the season changes', () => {
		const files = [file(1, 1), file(2, 1), file(3, 2), file(4, 3)]

		expect(seasonsOf(files).map(([season, list]) => [season, list.map(f => f.id)])).toEqual([
			[1, [1, 2]],
			[2, [3]],
			[3, [4]]
		])
	})

	it('counts a file without a season as the first', () => {
		const files = [file(1, null), file(2, 1)]

		expect(seasonsOf(files)).toEqual([[1, files]])
	})
})
