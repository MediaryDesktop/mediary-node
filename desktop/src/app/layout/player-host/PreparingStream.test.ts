import { describe, expect, it } from 'vitest'

import { matchingFiles } from './PreparingStream'

const FILES = [
	{ id: 0, path: 'Tempal Item no Chikara/Tempal_Item_no_Chikara_[01].mkv', size: 300 },
	{ id: 1, path: 'Tempal Item no Chikara/Tempal_Item_no_Chikara_[02].mkv', size: 310 },
	{ id: 2, path: 'Extras/Creditless OP.mkv', size: 50 }
]

describe('matchingFiles', () => {
	it('shows everything without a filter', () => {
		expect(matchingFiles(FILES, '')).toHaveLength(3)
		expect(matchingFiles(FILES, '   ')).toHaveLength(3)
	})

	it('keeps files whose path holds every word, in any case', () => {
		expect(matchingFiles(FILES, '[02]').map(file => file.id)).toEqual([1])
		expect(matchingFiles(FILES, 'tempal MKV').map(file => file.id)).toEqual([0, 1])
		expect(matchingFiles(FILES, 'creditless op').map(file => file.id)).toEqual([2])
	})

	it('finds nothing for a word no file has', () => {
		expect(matchingFiles(FILES, 'tempal 03')).toEqual([])
	})
})
