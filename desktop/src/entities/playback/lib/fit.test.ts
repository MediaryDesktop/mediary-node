import { describe, expect, it } from 'vitest'

import { videoFit } from './fit'

const WIDESCREEN = 1280 / 720

describe('videoFit', () => {
	it('fills a window that is only a little off the video proportions', () => {
		// 1442 x 824 window with a 16:9 video: a few pixels of bars become a crop.
		expect(videoFit(1442 / 824, WIDESCREEN)).toBe('cover')
	})

	it('keeps the bars when the proportions differ on purpose', () => {
		// A 4:3 picture in a 16:9 window stays whole.
		expect(videoFit(WIDESCREEN, 4 / 3)).toBe('contain')
	})

	it('falls back to contain until both proportions are known', () => {
		expect(videoFit(0, WIDESCREEN)).toBe('contain')
		expect(videoFit(WIDESCREEN, 0)).toBe('contain')
	})
})
