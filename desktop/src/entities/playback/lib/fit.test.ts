import { describe, expect, it } from 'vitest'

import { pictureAspect, videoFit } from './fit'

const WIDESCREEN = 1280 / 720

describe('videoFit', () => {
	it('fills a window that is only a little off the video proportions', () => {
		expect(videoFit(1442 / 824, WIDESCREEN)).toBe('cover')
	})

	it('keeps the bars when the proportions differ on purpose', () => {
		expect(videoFit(WIDESCREEN, 4 / 3)).toBe('contain')
	})

	it('falls back to contain until both proportions are known', () => {
		expect(videoFit(0, WIDESCREEN)).toBe('contain')
		expect(videoFit(WIDESCREEN, 0)).toBe('contain')
	})
})

describe('pictureAspect', () => {
	it('reads the proportions of the video track', () => {
		expect(pictureAspect({ video: { width: 1440, height: 1080 } })).toBe(4 / 3)
	})

	it('takes the first of several tracks when there is no main one', () => {
		expect(pictureAspect({ videos: [{ width: 1920, height: 800 }] })).toBe(1920 / 800)
	})

	it('is widescreen when the size is unknown', () => {
		expect(pictureAspect({})).toBe(16 / 9)
		expect(pictureAspect({ video: { width: 1920, height: 0 } })).toBe(16 / 9)
	})
})
