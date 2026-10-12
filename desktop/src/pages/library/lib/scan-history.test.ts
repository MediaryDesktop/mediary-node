import { describe, expect, it } from 'vitest'

import type { LibraryScanRunFileLog, LibraryScanRunGroup } from '@entities/library-item'

import { filterGroups, folderOf } from './scan-history'

function log(relPath: string): LibraryScanRunFileLog {
	return { rel_path: relPath } as LibraryScanRunFileLog
}

function group(mediaRef: string, title: string | null, files: string[]): LibraryScanRunGroup {
	return {
		media_ref: mediaRef,
		title: title === null ? undefined : { title },
		files: files.map(log)
	} as LibraryScanRunGroup
}

describe('scan history helpers', () => {
	it('takes the folder part of a path', () => {
		expect(folderOf('Frieren/Season 1/ep 01.mkv')).toBe('Frieren/Season 1')
		expect(folderOf('loose.mkv')).toBe('')
	})

	it('sorts the matched titles by name, falling back to the ref', () => {
		const groups = [
			group('anilist:2', 'Mushishi', []),
			group('anilist:1', null, []),
			group('anilist:3', 'Frieren', [])
		]

		expect(filterGroups(groups, '').map(item => item.media_ref)).toEqual([
			'anilist:1',
			'anilist:3',
			'anilist:2'
		])
	})

	it('keeps a title when its name or one of its files fits the search', () => {
		const groups = [
			group('anilist:1', 'Frieren', ['a/ep 01.mkv']),
			group('anilist:2', 'Mushishi', ['b/frieren-ova.mkv'])
		]

		expect(filterGroups(groups, 'frieren')).toHaveLength(2)
		expect(filterGroups(groups, 'mushi').map(item => item.media_ref)).toEqual(['anilist:2'])
	})
})
