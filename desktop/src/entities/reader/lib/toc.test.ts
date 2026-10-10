import type { FoliateTocItem } from 'foliate-js/view.js'
import { describe, expect, it } from 'vitest'

import { indexToc } from './toc'

const items: FoliateTocItem[] = [
	{ label: 'Part one', href: '/part-1' },
	{
		label: 'Part two',
		href: '/part-2',
		subitems: [
			{ label: 'Chapter 2.1', href: '/2-1' },
			{ label: 'Chapter 2.2', href: '/2-2' }
		]
	},
	{ label: 'Part three', href: '/part-3' }
]

describe('indexToc', () => {
	it('numbers chapters in reading order, nested ones included', () => {
		const index = indexToc(items, null)

		expect(index.total).toBe(5)
		expect(index.numbers.get(items[0]!)).toBe(1)
		expect(index.numbers.get(items[1]!)).toBe(2)
		expect(index.numbers.get(items[1]!.subitems![0]!)).toBe(3)
		expect(index.numbers.get(items[1]!.subitems![1]!)).toBe(4)
		expect(index.numbers.get(items[2]!)).toBe(5)
	})

	it('finds the current chapter by its label', () => {
		expect(indexToc(items, 'Chapter 2.2').current).toBe(4)
		expect(indexToc(items, 'Part three').current).toBe(5)
	})

	it('leaves the current chapter null when nothing matches', () => {
		expect(indexToc(items, 'Missing').current).toBeNull()
		expect(indexToc(items, null).current).toBeNull()
	})
})
