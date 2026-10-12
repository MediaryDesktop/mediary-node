import { describe, expect, it } from 'vitest'

import type { MangaDownload } from '@entities/manga-source'
import type { ChapterOption, ChapterRow } from '@entities/reader'

import { activeDownload, latestDownloads, presentSources, savableOption } from './chapters'

function option(ref: string, source: string, sourceName = source): ChapterOption {
	return { ref, number: '1', title: 'Chapter 1', source, sourceName, detail: '' }
}

function row(...options: ChapterOption[]): ChapterRow {
	return { key: '1', number: '1', options }
}

function download(chapterRef: string, state: string): MangaDownload {
	return { chapter_ref: chapterRef, state } as MangaDownload
}

describe('chapter list helpers', () => {
	it('lists each source once, with its name', () => {
		const rows = [
			row(option('a', 'local', 'Library')),
			row(option('b', 'opds:1', 'Kavita'), option('c', 'local', 'Library'))
		]

		expect([...presentSources(rows)]).toEqual([
			['local', 'Library'],
			['opds:1', 'Kavita']
		])
	})

	it('keeps the newest download of each chapter', () => {
		const downloads = latestDownloads([download('a', 'running'), download('a', 'failed')])

		expect(downloads.get('a')?.state).toBe('running')
	})

	it('saves a chapter from its server copy unless the library has it or it is under way', () => {
		const online = option('b', 'opds:1')

		expect(savableOption(row(online), new Map())).toBe(online)
		expect(savableOption(row(option('a', 'local'), online), new Map())).toBeNull()

		const running = latestDownloads([download('b', 'queued')])

		expect(savableOption(row(online), running)).toBeNull()
		expect(activeDownload(row(online), running)?.state).toBe('queued')
	})
})
