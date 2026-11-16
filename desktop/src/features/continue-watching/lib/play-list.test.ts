import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { playList } from './play-list'

let nextId = 1

function file(part: { episode: number; season?: number; mediaRef?: string; missing?: boolean }): LibraryFile {
	return {
		id: nextId++,
		root_id: 1,
		path: `/library/e${part.episode}.mkv`,
		rel_path: `e${part.episode}.mkv`,
		kind: 'video',
		size_bytes: 1,
		modified_at: '2026-01-01T00:00:00Z',
		missing: part.missing ?? false,
		ignored: false,
		parsed: { form: 'series', episode: part.episode, season: part.season },
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

describe('playList', () => {
	it('lists every episode the source knows, with the file that holds it', () => {
		const second = file({ episode: 2 })
		const list = playList(
			'anilist:1',
			[file({ episode: 1 }), second],
			[1, 2, 3].map(number => ({ number }) as MediaEpisode),
			1
		)

		expect(list.entries.map(entry => entry.number)).toEqual([1, 2, 3])
		expect(list.entries.map(entry => entry.watched)).toEqual([true, false, false])
		expect(list.next?.number).toBe(2)
		expect(list.next?.file).toBe(second)
		expect(list.entries[2]?.file).toBeNull()
	})

	it('counts seasons in the order of the list and starts the next one where progress ends', () => {
		const list = playList(
			'tmdb:tv:1',
			[file({ season: 2, episode: 1, mediaRef: 'tmdb:tv:1' })],
			seasons(2, 2),
			2
		)

		expect(list.seasonal).toBe(true)
		expect(list.seasons).toEqual([1, 2])
		expect(list.next).toMatchObject({ season: 2, number: 1, position: 3 })
		expect(list.next?.file).not.toBeNull()
	})

	it('falls back to the files when the source has no episode list', () => {
		const list = playList('anilist:1', [file({ episode: 2 }), file({ episode: 1 })], [], 0)

		expect(list.entries.map(entry => entry.number)).toEqual([1, 2])
		expect(list.first?.number).toBe(1)
	})

	it('leaves out files of other titles and files gone from disk', () => {
		const list = playList(
			'anilist:1',
			[file({ episode: 1, mediaRef: 'anilist:2' }), file({ episode: 2, missing: true })],
			[],
			0
		)

		expect(list.entries).toEqual([])
		expect(list.next).toBeNull()
	})

	it('leaves out episodes that have not aired yet', () => {
		const now = new Date('2026-06-15T00:00:00Z')
		const episodes = [
			{ number: 1, air_date: '2026-06-01' },
			{ number: 2, air_date: '2026-06-08' },
			{ number: 3, air_date: '2026-06-22' },
			{ number: 4, air_date: null }
		] as MediaEpisode[]

		const list = playList('anilist:1', [file({ episode: 1 })], episodes, 1, now)

		expect(list.entries.map(entry => entry.number)).toEqual([1, 2, 4])
		expect(list.next?.number).toBe(2)
	})
})
