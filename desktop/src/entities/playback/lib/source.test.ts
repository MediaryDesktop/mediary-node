import { describe, expect, it } from 'vitest'

import { canFallBack, chooseSource } from './source'

const H264 = 'video/mp4; codecs="avc1.640028, mp4a.40.2"'
const plays = () => 'probably' as const
const cannot = () => '' as const

describe('chooseSource', () => {
	const stream = { info: { mime_codec: H264 }, hls_url: '/v1/hls/7/index.m3u8' } as never

	it('plays the file itself when the browser can', () => {
		expect(chooseSource(stream, { directFailed: false, canPlayType: plays })).toEqual({ kind: 'direct' })
	})

	it('falls back to the transcode when the browser cannot, or direct play failed', () => {
		const hls = { kind: 'hls', path: '/v1/hls/7/index.m3u8' }

		expect(chooseSource(stream, { directFailed: false, canPlayType: cannot })).toEqual(hls)
		expect(chooseSource(stream, { directFailed: true, canPlayType: plays })).toEqual(hls)
	})

	it('has nothing to play when there is no transcode either', () => {
		const bare = { info: { mime_codec: H264 } } as never

		expect(chooseSource(bare, { directFailed: true, canPlayType: plays })).toBeNull()
	})
})

describe('canFallBack', () => {
	it('is only for direct play with a transcode behind it', () => {
		expect(canFallBack({ kind: 'direct' }, { hls_url: '/x' })).toBe(true)
		expect(canFallBack({ kind: 'direct' }, {})).toBe(false)
		expect(canFallBack({ kind: 'hls', path: '/x' }, { hls_url: '/x' })).toBe(false)
	})
})
