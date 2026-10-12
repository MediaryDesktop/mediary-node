import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import {
	episodeFor,
	episodeNumber,
	episodeOrder,
	groupTitleFiles,
	indexEpisodes,
	isWatched
} from './episodes'

let nextId = 1

function file(part: {
	path: string
	episode?: number
	matchedEpisode?: number
	form?: LibraryFile['parsed']['form']
	missing?: boolean
	ignored?: boolean
}): LibraryFile {
	return {
		id: nextId++,
		root_id: 1,
		path: `/library/${part.path}`,
		rel_path: part.path,
		kind: 'video',
		size_bytes: 1,
		modified_at: '2026-01-01T00:00:00Z',
		missing: part.missing ?? false,
		ignored: part.ignored ?? false,
		parsed: { form: part.form ?? 'series', episode: part.episode },
		match: {
			media_ref: 'anilist:1',
			episode: part.matchedEpisode ?? part.episode,
			confidence: 1,
			source: 'auto'
		}
	} as LibraryFile
}

describe('groupTitleFiles', () => {
	it('sorts main episodes by number and splits specials and extras off', () => {
		const groups = groupTitleFiles(
			[
				file({ path: 'Show - 02.mkv', episode: 2 }),
				file({ path: 'Show - NCOP.mkv', form: 'extra' }),
				file({ path: 'Show - 01.mkv', episode: 1 }),
				file({ path: 'Show - OVA.mkv', form: 'special', episode: 1 })
			],
			0
		)

		expect(groups.main.map(f => f.rel_path)).toEqual(['Show - 01.mkv', 'Show - 02.mkv'])
		expect(groups.specials.map(f => f.rel_path)).toEqual(['Show - OVA.mkv'])
		expect(groups.others.map(f => f.rel_path)).toEqual(['Show - NCOP.mkv'])
	})

	it('offers only what is past the progress, once per episode, and nothing missing', () => {
		const groups = groupTitleFiles(
			[
				file({ path: 'Show - 01.mkv', episode: 1 }),
				file({ path: 'Show - 02 [720p].mkv', episode: 2 }),
				file({ path: 'Show - 02 [1080p].mkv', episode: 2 }),
				file({ path: 'Show - 03.mkv', episode: 3, missing: true }),
				file({ path: 'Show - 04.mkv', episode: 4 })
			],
			1
		)

		expect(groups.toWatch.map(f => episodeNumber(f))).toEqual([2, 4])
	})

	it('leaves ignored files out entirely', () => {
		const groups = groupTitleFiles([file({ path: 'Show - 01.mkv', episode: 1, ignored: true })], 0)

		expect(groups.main).toEqual([])
		expect(groups.toWatch).toEqual([])
	})
})

describe('episodeNumber', () => {
	it('trusts the match over the name', () => {
		expect(episodeNumber(file({ path: 'Show - 13.mkv', episode: 13, matchedEpisode: 1 }))).toBe(1)
	})
})

describe('isWatched', () => {
	it('counts a numberless file as watched once there is any progress', () => {
		const movie = file({ path: 'Movie.mkv', form: 'movie' })

		expect(isWatched(movie, 0)).toBe(false)
		expect(isWatched(movie, 1)).toBe(true)
	})
})

function showFile(path: string, season: number | undefined, episode: number): LibraryFile {
	const made = file({ path, episode })
	made.match = { ...made.match!, media_ref: 'tmdb:tv:1396', season }
	made.parsed = { ...made.parsed, season }

	return made
}

const breakingBad: MediaEpisode[] = [
	{ season: 1, number: 1, title: 'Pilot' },
	{ season: 1, number: 2, title: "Cat's in the Bag..." },
	{ season: 2, number: 1, title: 'Seven Thirty-Seven' }
] as MediaEpisode[]

describe('a show numbered by season', () => {
	const index = indexEpisodes(breakingBad)
	const order = episodeOrder(index)

	it('finds each file its own episode', () => {
		expect(index.seasonal).toBe(true)
		expect(episodeFor(index, showFile('s2e1.mkv', 2, 1))?.title).toBe('Seven Thirty-Seven')
		expect(episodeFor(index, showFile('e2.mkv', undefined, 2))?.title).toBe("Cat's in the Bag...")
	})

	it('counts across seasons, as progress does', () => {
		const second = showFile('s2e1.mkv', 2, 1)

		expect(order(second)).toBe(3)
		expect(isWatched(second, 2, order)).toBe(false)
		expect(isWatched(second, 3, order)).toBe(true)
	})

	it('puts an episode the list does not hold after every known one', () => {
		const groups = groupTitleFiles(
			[showFile('s3e1.mkv', 3, 1), showFile('s2e1.mkv', 2, 1), showFile('s1e1.mkv', 1, 1)],
			1,
			order
		)

		expect(groups.main.map(made => made.rel_path)).toEqual(['s1e1.mkv', 's2e1.mkv', 's3e1.mkv'])
		expect(groups.toWatch.map(made => made.rel_path)).toEqual(['s2e1.mkv', 's3e1.mkv'])
		expect(isWatched(showFile('s3e1.mkv', 3, 1), 99, order)).toBe(false)
	})

	it('leaves an anime numbered as before', () => {
		const anime = indexEpisodes([{ number: 1 }, { number: 2 }] as MediaEpisode[])

		expect(anime.seasonal).toBe(false)
		expect(episodeOrder(anime)).toBe(episodeNumber)
		expect(episodeFor(anime, file({ path: 'e2.mkv', episode: 2 }))?.number).toBe(2)
	})
})
