import { describe, expect, it } from 'vitest'

import { coverPreviewUrl, coverSource } from './cover'

describe('coverPreviewUrl', () => {
	it('shows the cover the title has until the choice changes', () => {
		expect(coverPreviewUrl({ kind: 'keep' }, 'old.jpg')).toBe('old.jpg')
		expect(coverPreviewUrl({ kind: 'keep' }, undefined)).toBeNull()
	})

	it('shows none once it is removed, and the new pick otherwise', () => {
		expect(coverPreviewUrl({ kind: 'remove' }, 'old.jpg')).toBeNull()
		expect(
			coverPreviewUrl(
				{ kind: 'url', value: 'big.jpg', previewUrl: 'small.jpg', source: 'search' },
				'old.jpg'
			)
		).toBe('small.jpg')
	})
})

describe('coverSource', () => {
	it('sends a link or the file, and nothing to keep or remove', () => {
		expect(coverSource({ kind: 'url', value: 'a.jpg', previewUrl: 'a.jpg', source: 'url' })).toEqual({
			url: 'a.jpg'
		})
		expect(
			coverSource({ kind: 'data', value: 'AAA', previewUrl: 'blob:', name: 'a.png', size: 3 })
		).toEqual({
			data: 'AAA'
		})
		expect(coverSource({ kind: 'keep' })).toBeNull()
		expect(coverSource({ kind: 'remove' })).toBeNull()
	})
})
