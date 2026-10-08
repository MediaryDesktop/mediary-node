import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'
import type { TorrentFile } from '@entities/torrent'

import { initialSelection, OwnedEpisodes, sortFiles } from './file-selection'

function file(
	index: number,
	name: string,
	episode?: number,
	video = true,
	selected = true,
	season?: number
): TorrentFile {
	return { index, name, size: 1, progress: 0, selected, video, episode, season }
}

function libraryFile(episode: number, season?: number): LibraryFile {
	return { missing: false, parsed: { episode, season }, match: { episode, season } } as LibraryFile
}

const EP1 = file(0, 'Frieren - 01.mkv', 1)
const EP2 = file(1, 'Frieren - 02.mkv', 2)
const EP3 = file(2, 'Frieren - 03.mkv', 3)
const SUBS = file(3, 'Frieren - 02.ass', undefined, false)
const OPENING = file(4, 'NCOP01.mkv')

const BATCH = [EP1, EP2, EP3, SUBS, OPENING]

const ownedOneAndTwo = OwnedEpisodes.fromLibrary([libraryFile(1), libraryFile(2)], false)

describe('torrent file selection', () => {
	it('leaves out the episodes the library already has when choosing', () => {
		const selected = initialSelection(BATCH, ownedOneAndTwo, true)

		expect([...selected].sort()).toEqual([2, 3, 4])
	})

	it('follows the client once the choice is made', () => {
		const files = BATCH.map(item => ({ ...item, selected: item.index === 1 }))

		expect([...initialSelection(files, ownedOneAndTwo, false)]).toEqual([1])
	})

	it('orders files by episode, then by name', () => {
		const sorted = sortFiles([OPENING, EP3, SUBS, EP1])

		expect(sorted.map(item => item.index)).toEqual([0, 2, 3, 4])
	})

	it('tells a show’s seasons apart', () => {
		const owned = OwnedEpisodes.fromLibrary([libraryFile(5, 1)], true)
		const firstSeason = file(0, 'Show.S01E05.mkv', 5, true, true, 1)
		const secondSeason = file(1, 'Show.S02E05.mkv', 5, true, true, 2)

		expect([...initialSelection([firstSeason, secondSeason], owned, true)]).toEqual([1])
		expect(sortFiles([secondSeason, firstSeason]).map(item => item.index)).toEqual([0, 1])
	})
})
