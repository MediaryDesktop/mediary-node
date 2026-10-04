import { describe, expect, it } from 'vitest'

import { filterIcons, iconLabel } from './icon-search'

const ICONS = ['book', 'book-open', 'bookmark', 'heart', 'heart-crack', 'notebook']

describe('filterIcons', () => {
	it('keeps everything for an empty query', () => {
		expect(filterIcons(ICONS, '  ')).toEqual(ICONS)
	})

	it('puts names that start with the query first', () => {
		expect(filterIcons(ICONS, 'book')).toEqual(['book', 'book-open', 'bookmark', 'notebook'])
	})

	it('needs every word, in any order and separated either way', () => {
		expect(filterIcons(ICONS, 'open book')).toEqual(['book-open'])
		expect(filterIcons(ICONS, 'heart-crack')).toEqual(['heart-crack'])
	})

	it('finds nothing for a name that is not there', () => {
		expect(filterIcons(ICONS, 'rocket')).toEqual([])
	})
})

describe('iconLabel', () => {
	it('reads a name as words', () => {
		expect(iconLabel('heart-crack')).toBe('Heart crack')
	})
})
