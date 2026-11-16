import { describe, expect, it } from 'vitest'

import { problemCode, problemDetail } from '@shared/api'

import { playerFailure } from './failure'

const MISSING_FFMPEG = JSON.stringify({
	type: 'urn:mediary:problem:tool-missing',
	title: 'Precondition Failed',
	status: 428,
	detail: 'FFmpeg is not installed'
})

describe('playerFailure', () => {
	it('keeps the problem type, so the screen can tell a missing tool', () => {
		const failure = playerFailure({ status: 428, responseText: MISSING_FFMPEG })

		expect(problemCode(failure)).toBe('tool-missing')
		expect(failure.message).toBe('FFmpeg is not installed')
		expect(problemDetail(failure, 'fallback')).toBe('FFmpeg is not installed')
	})

	it('has only the status when the body is not a problem', () => {
		expect(playerFailure({ status: 502, responseText: '<html>Bad gateway</html>' })).toEqual({
			status: 502
		})
		expect(playerFailure({ status: 0 })).toEqual({ status: 0 })
	})
})
