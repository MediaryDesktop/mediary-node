import { describe, expect, it } from 'vitest'

import { canDirectPlay } from './codecs'

function supporting(...types: string[]) {
	return (type: string): CanPlayTypeResult => (types.includes(type) ? 'probably' : '')
}

const H264_AAC = 'codecs="avc1.640028, mp4a.40.2"'

describe('canDirectPlay', () => {
	it('trusts a plain "probably"', () => {
		expect(canDirectPlay(`video/mp4; ${H264_AAC}`, supporting(`video/mp4; ${H264_AAC}`))).toBe(true)
	})

	it('plays Matroska when the same codecs would play in mp4', () => {
		expect(canDirectPlay(`video/matroska; ${H264_AAC}`, supporting(`video/mp4; ${H264_AAC}`))).toBe(true)
	})

	it('does not settle for "maybe"', () => {
		expect(canDirectPlay(`video/mp4; ${H264_AAC}`, () => 'maybe')).toBe(false)
	})

	it('refuses a file the node could not describe', () => {
		expect(canDirectPlay(undefined, () => 'probably')).toBe(false)
	})

	it('refuses Matroska whose codecs play nowhere', () => {
		expect(canDirectPlay('video/matroska; codecs="hvc1.2.4.L153.B0, ec-3"', supporting())).toBe(false)
	})
})
