import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'

import { groupFiles, unmatchedCount, visibleFiles } from './library-view'

interface FileOptions {
	id: number
	relPath: string
	title?: string
	form?: NonNullable<LibraryFile['parsed']['form']>
	episode?: number
	mediaRef?: string
	missing?: boolean
}

function file({ id, relPath, title, form = 'series', episode, mediaRef, missing }: FileOptions): LibraryFile {
	return {
		id,
		root_id: 1,
		path: `D:/library/${relPath}`,
		rel_path: relPath,
		kind: 'video',
		size_bytes: 100,
		modified_at: '2026-01-01T00:00:00Z',
		missing: missing ?? false,
		parsed: { form, title, episode },
		match: mediaRef
			? { media_ref: mediaRef, confidence: 1, source: 'auto', episode, season: undefined }
			: undefined
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
		const [group] = groupFiles([frieren2, frieren1], 'Unrecognized')

		expect(group?.title).toBe('Frieren')
		expect(group?.files.map(item => item.id)).toEqual([1, 2])
	})

	it('keeps a matched title apart from an unmatched one of the same name', () => {
		const sameName = file({ id: 6, relPath: 'Elsewhere/ep 01.mkv', title: 'Frieren', episode: 1 })

		expect(groupFiles([frieren1, sameName], 'Unrecognized')).toHaveLength(2)
	})

	it('falls back for a file whose name says nothing', () => {
		const nameless = file({ id: 7, relPath: 'random.mkv' })

		expect(groupFiles([nameless], 'Unrecognized')[0]?.title).toBe('Unrecognized')
	})
})
