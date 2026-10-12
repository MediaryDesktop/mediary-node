import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { upNext } from './up-next'

let nextId = 1

function file(part: {
	path: string
	mediaRef?: string
	episode?: number
	season?: number
	form?: LibraryFile['parsed']['form']
	missing?: boolean
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
		ignored: false,
		parsed: { form: part.form ?? 'series', episode: part.episode, season: part.season },
		match: {
			media_ref: part.mediaRef ?? 'anilist:1',
			episode: part.episode,
			season: part.season,
			confidence: 1,
			source: 'auto'
		}
	} as LibraryFile
}

function seasons(...counts: number[]): MediaEpisode[] {
	return counts.flatMap((count, index) =>
		Array.from(
			{ length: count },
			(_, number) => ({ season: index + 1, number: number + 1 }) as MediaEpisode
		)
	)
}

describe('upNext', () => {
	it('picks the episode right after the progress', () => {
		const next = upNext(
			'anilist:1',
			[
				file({ path: 'Show - 01.mkv', episode: 1 }),
				file({ path: 'Show - 02.mkv', episode: 2 }),
				file({ path: 'Show - 03.mkv', episode: 3 })
			],
			[],
			1
		)

		expect(next?.file.rel_path).toBe('Show - 02.mkv')
		expect(next?.seasonal).toBe(false)
	})

	it('offers nothing when the next episode is not in the library', () => {
		const next = upNext(
			'anilist:1',
			[file({ path: 'Show - 01.mkv', episode: 1 }), file({ path: 'Show - 05.mkv', episode: 5 })],
			[],
			1
		)

		expect(next).toBeNull()
	})

	it('skips a missing file and another title’s files', () => {
		expect(
			upNext('anilist:1', [file({ path: 'Show - 02.mkv', episode: 2, missing: true })], [], 1)
		).toBeNull()
		expect(
			upNext('anilist:1', [file({ path: 'Other - 02.mkv', episode: 2, mediaRef: 'anilist:2' })], [], 1)
		).toBeNull()
	})

	it('counts a show across its seasons', () => {
		const next = upNext(
			'tmdb:tv:1',
			[
				file({ path: 'Show S01E10.mkv', episode: 10, season: 1, mediaRef: 'tmdb:tv:1' }),
				file({ path: 'Show S02E01.mkv', episode: 1, season: 2, mediaRef: 'tmdb:tv:1' })
			],
			seasons(10, 8),
			10
		)

		expect(next?.file.rel_path).toBe('Show S02E01.mkv')
		expect(next?.seasonal).toBe(true)
	})

	it('offers an unwatched movie and nothing once it is watched', () => {
		const movie = file({ path: 'Film (2020).mkv', form: 'movie', mediaRef: 'tmdb:movie:1' })

		expect(upNext('tmdb:movie:1', [movie], [], 0)?.file).toBe(movie)
		expect(upNext('tmdb:movie:1', [movie], [], 1)).toBeNull()
	})
})
