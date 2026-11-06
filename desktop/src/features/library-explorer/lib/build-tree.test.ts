import { describe, expect, it } from 'vitest'

import type { LibraryFile, LibraryRoot } from '@entities/library-item'

import { allFolderKeys, buildTree, checkState, fileIdsUnder, flattenTree, matchesFilter } from './build-tree'
import type { TreeFolder, TreeNode } from './build-tree'

let nextId = 1

function file(relPath: string, overrides: Partial<LibraryFile> = {}): LibraryFile {
	return {
		id: nextId++,
		root_id: 1,
		path: `D:\\Anime\\${relPath.split('/').join('\\')}`,
		rel_path: relPath,
		kind: 'video',
		size_bytes: 10,
		modified_at: '2026-01-01T00:00:00Z',
		missing: false,
		ignored: false,
		parsed: { form: 'series', title: 'Frieren' },
		...overrides
	}
}

const root: LibraryRoot = {
	id: 1,
	path: 'D:\\Anime',
	content: 'anime',
	added_at: '2026-01-01T00:00:00Z',
	file_count: 0,
	missing_count: 0,
	unmatched_count: 0
}

function folderAt(nodes: TreeNode[], ...names: string[]): TreeFolder {
	let current = nodes

	for (const name of names) {
		const found = current.find((node): node is TreeFolder => node.kind === 'folder' && node.name === name)

		if (!found) {
			throw new Error(`no folder named ${name} in ${current.map(node => node.name).join(', ')}`)
		}

		if (name === names[names.length - 1]) {
			return found
		}

		current = found.children
	}

	throw new Error('no folder asked for')
}

describe('buildTree', () => {
	it('turns paths back into the folders they came from', () => {
		const tree = buildTree(
			[file('Frieren/Season 1/ep 01.mkv'), file('Frieren/Season 1/ep 02.mkv')],
			[root]
		)

		expect(tree.map(node => node.name)).toEqual(['D:\\Anime'])

		const season = folderAt(tree, 'D:\\Anime', 'Frieren', 'Season 1')

		expect(season.children.map(child => child.name)).toEqual(['ep 01.mkv', 'ep 02.mkv'])
	})

	it('counts every file underneath a folder, not just its own', () => {
		const tree = buildTree(
			[
				file('Frieren/Season 1/ep 01.mkv'),
				file('Frieren/Season 2/ep 01.mkv', {
					match: { media_ref: 'anilist:1', confidence: 1, source: 'manual' }
				})
			],
			[root]
		)

		const show = folderAt(tree, 'D:\\Anime', 'Frieren')

		expect(show.files).toBe(2)
		expect(show.matched).toBe(1)
	})

	it('puts folders before files and orders episodes by number', () => {
		const tree = buildTree(
			[file('Frieren/ep 10.mkv'), file('Frieren/ep 2.mkv'), file('Frieren/Extras/ncop.mkv')],
			[root]
		)

		const show = folderAt(tree, 'D:\\Anime', 'Frieren')

		expect(show.children.map(child => child.kind)).toEqual(['folder', 'file', 'file'])
		expect(show.children.map(child => child.name)).toEqual(['Extras', 'ep 2.mkv', 'ep 10.mkv'])
	})

	it('leaves out a root with no files', () => {
		expect(buildTree([], [root])).toHaveLength(0)
	})
})

describe('flattenTree', () => {
	it('only walks into folders that are open', () => {
		const tree = buildTree([file('Frieren/Season 1/ep 01.mkv')], [root])

		expect(flattenTree(tree, new Set())).toHaveLength(1)

		const rootFolder = folderAt(tree, 'D:\\Anime')
		const show = folderAt(tree, 'D:\\Anime', 'Frieren')

		expect(flattenTree(tree, new Set([rootFolder.key, show.key])).map(row => row.depth)).toEqual([
			0, 1, 2
		])
	})
})

describe('matchesFilter', () => {
	it('keeps an ignored file out of the unmatched bucket', () => {
		const ignored = file('Frieren/sample.mkv', { ignored: true })

		expect(matchesFilter(ignored, 'unmatched')).toBe(false)
		expect(matchesFilter(ignored, 'ignored')).toBe(true)
		expect(matchesFilter(ignored, null)).toBe(true)
	})
})

describe('folder helpers', () => {
	const tree = buildTree(
		[file('Frieren/Season 1/ep 01.mkv'), file('Frieren/Season 1/ep 02.mkv'), file('Frieren/extra.mkv')],
		[root]
	)
	const show = folderAt(tree, 'D:\\Anime', 'Frieren')
	const season = folderAt(tree, 'D:\\Anime', 'Frieren', 'Season 1')
	const ids = fileIdsUnder(show)

	it('collects every file under a folder', () => {
		expect(ids).toHaveLength(3)
	})

	it('lists the key of every folder', () => {
		expect(allFolderKeys(tree)).toEqual(new Set([folderAt(tree, 'D:\\Anime').key, show.key, season.key]))
	})

	it('ticks a folder fully, partly or not at all', () => {
		expect(checkState(show, new Set())).toBe(false)
		expect(checkState(show, new Set(ids.slice(0, 1)))).toBe('mixed')
		expect(checkState(show, new Set(ids))).toBe(true)
	})
})
