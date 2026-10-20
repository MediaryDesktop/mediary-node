import { describe, expect, it } from 'vitest'

import { HttpRequestError } from '@shared/api'

import { isMissingToolError } from './missing'

function failure(status: number, detail: string) {
	return new HttpRequestError(detail, { status, body: { detail } })
}

describe('isMissingToolError', () => {
	it('knows the node saying a program is nowhere', () => {
		expect(
			isMissingToolError(
				failure(
					428,
					'mpv was not found: install mpv on the Extensions page, under Dependencies, or set NODE_MPV_PATH'
				)
			)
		).toBe(true)
	})

	it('leaves other preconditions alone', () => {
		expect(isMissingToolError(failure(428, 'transcoding is turned off on this node'))).toBe(false)
		expect(isMissingToolError(failure(404, 'file 3 was not found'))).toBe(false)
		expect(isMissingToolError(null)).toBe(false)
	})
})
