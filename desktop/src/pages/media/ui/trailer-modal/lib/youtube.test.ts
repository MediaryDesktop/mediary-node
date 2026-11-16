import { describe, expect, it } from 'vitest'

import { youtubeUrl } from './youtube'

describe('youtubeUrl', () => {
	it('links a YouTube trailer to its page', () => {
		expect(youtubeUrl({ site: 'youtube', id: 'abc_123', thumbnail: null })).toBe(
			'https://www.youtube.com/watch?v=abc_123'
		)
	})

	it('escapes the id', () => {
		expect(youtubeUrl({ site: 'youtube', id: 'a&b=c', thumbnail: null })).toBe(
			'https://www.youtube.com/watch?v=a%26b%3Dc'
		)
	})

	it('has nothing for another site, an empty id or no trailer', () => {
		expect(youtubeUrl({ site: 'dailymotion', id: 'x7', thumbnail: null })).toBeNull()
		expect(youtubeUrl({ site: 'youtube', id: '', thumbnail: null })).toBeNull()
		expect(youtubeUrl(null)).toBeNull()
		expect(youtubeUrl(undefined)).toBeNull()
	})
})
