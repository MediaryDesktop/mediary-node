import { describe, expect, it } from 'vitest'

import type { LibraryFile, LibraryTitle } from '@entities/library-item'

import { groupFiles, titleIndex, unmatchedCount, visibleFiles } from './library-view'

interface FileOptions {
	id: number
	relPath: string
	title?: string
	form?: NonNullable<LibraryFile['parsed']['form']>
	episode?: number
	season?: number
	mediaRef?: string
	missing?: boolean
}

function file({
	id,
	relPath,
	title,
	form = 'series',
	episode,
	season,
	mediaRef,
	missing
}: FileOptions): LibraryFile {
	return {
		id,
		root_id: 1,
		path: `D:/library/${relPath}`,
		rel_path: relPath,
		kind: 'video',
		size_bytes: 100,
		modified_at: '2026-01-01T00:00:00Z',
		missing: missing ?? false,
		parsed: { form, title, episode, season },
		match: mediaRef ? { media_ref: mediaRef, confidence: 1, source: 'auto', episode, season } : undefined
	}
}

const frieren1 = file({
	id: 1,
	relPath: 'Frieren/ep 01.mkv',
	title: 'Frieren',
	episode: 1,
	mediaRef: 'anilist:154587'
})
const frieren2 = file({
	id: 2,
	relPath: 'Frieren/ep 02.mkv',
	title: 'Frieren',
	episode: 2,
	mediaRef: 'anilist:154587'
})
const unknown = file({ id: 3, relPath: 'Unsorted/some file.mkv', title: 'Some File' })
const opening = file({ id: 4, relPath: 'Frieren/NCOP01.mkv', title: 'Frieren', form: 'extra' })
const gone = file({ id: 5, relPath: 'Frieren/ep 03.mkv', title: 'Frieren', episode: 3, missing: true })

describe('unmatchedCount', () => {
	it('counts what the user could still match', () => {
		expect(unmatchedCount([frieren1, unknown, gone])).toBe(2)
	})

	it('leaves out openings and extras, which belong to no episode', () => {
		expect(unmatchedCount([opening])).toBe(0)
	})
})

describe('visibleFiles', () => {
	const files = [frieren1, frieren2, unknown, opening, gone]

	it('shows everything by default', () => {
		expect(visibleFiles(files, 'all', '')).toHaveLength(5)
	})

	it('narrows to files waiting for a title', () => {
		expect(visibleFiles(files, 'unmatched', '').map(item => item.id)).toEqual([3, 5])
	})

	it('narrows to files the last scan did not find', () => {
		expect(visibleFiles(files, 'missing', '').map(item => item.id)).toEqual([5])
	})

	it('searches the parsed title and the path', () => {
		expect(visibleFiles(files, 'all', 'frieren')).toHaveLength(4)
		expect(visibleFiles(files, 'all', 'unsorted').map(item => item.id)).toEqual([3])
	})
})

describe('groupFiles', () => {
	it('keeps episodes of one title together and in order', () => {
		const [group] = groupFiles([frieren2, frieren1], new Map(), 'Unrecognized')

		expect(group?.title).toBe('Frieren')
		expect(group?.files.map(item => item.id)).toEqual([1, 2])
	})

	it('keeps a matched title apart from an unmatched one of the same name', () => {
		const sameName = file({ id: 6, relPath: 'Elsewhere/ep 01.mkv', title: 'Frieren', episode: 1 })

		expect(groupFiles([frieren1, sameName], new Map(), 'Unrecognized')).toHaveLength(2)
	})

	it('falls back for a file whose name says nothing', () => {
		const nameless = file({ id: 7, relPath: 'random.mkv' })

		expect(groupFiles([nameless], new Map(), 'Unrecognized')[0]?.title).toBe('Unrecognized')
	})
})

describe('groupFiles with what the node knows about the titles', () => {
	const described: LibraryTitle[] = [
		{
			media_ref: 'anilist:154587',
			media_type: 'anime',
			title: 'Sousou no Frieren',
			cover_image: 'https://img/frieren.jpg'
		}
	]

	it('names a group after the title it was matched to, not after the folder', () => {
		const [group] = groupFiles([frieren1], titleIndex(described), 'Unrecognized')

		expect(group?.title).toBe('Sousou no Frieren')
		expect(group?.title_info?.cover_image).toBe('https://img/frieren.jpg')
	})

	it('falls back to the name on disk for a title the node has never fetched', () => {
		const [group] = groupFiles([frieren1], titleIndex([]), 'Unrecognized')

		expect(group?.title).toBe('Frieren')
		expect(group?.title_info).toBeUndefined()
	})

	it('lists the seasons its files belong to, in order and without repeats', () => {
		const seasons = [2, 1, 2].map((season, index) =>
			file({
				id: 40 + index,
				relPath: `Frieren/S0${season}/ep 0${index + 1}.mkv`,
				title: 'Frieren',
				episode: index + 1,
				season,
				mediaRef: 'anilist:154587'
			})
		)

		const [group] = groupFiles(seasons, titleIndex(described), 'Unrecognized')

		expect(group?.seasons).toEqual([1, 2])
	})

	// The numbers, not how many: a show filed entirely as "s02e…" has one season,
	// and reporting that as "1 season" would read as season one.
	it('keeps the season number of a show that has only one', () => {
		const files = [1, 2].map(episode =>
			file({
				id: 20 + episode,
				relPath: `Kimetsu/s02e0${episode}_720.mp4`,
				title: 'Kimetsu no Yaiba',
				season: 2,
				episode
			})
		)

		expect(groupFiles(files, titleIndex([]), 'Unrecognized')[0]?.seasons).toEqual([2])
	})

	it('says nothing about seasons when no file names one', () => {
		const nameless = file({ id: 30, relPath: 'Movie/film.mkv', title: 'Film', form: 'movie' })

		expect(groupFiles([nameless], titleIndex([]), 'Unrecognized')[0]?.seasons).toEqual([])
	})

	// A card that says "matched" while some of its files are not would send the
	// user looking for the ones that are missing a title.
	it('calls a group matched only when every file in it is', () => {
		const unmatched = file({ id: 10, relPath: 'Frieren/ep 03.mkv', title: 'Frieren', episode: 3 })

		const [matched] = groupFiles([frieren1], titleIndex(described), 'Unrecognized')
		const [partial] = groupFiles([unmatched], titleIndex(described), 'Unrecognized')

		expect(matched?.matched).toBe(true)
		expect(partial?.matched).toBe(false)
	})
})
