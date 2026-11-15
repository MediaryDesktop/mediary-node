import { describe, expect, it } from 'vitest'

import { HttpRequestError } from '@shared/api'

import { isMissingToolError } from './missing'

function failure(status: number, detail: string, type?: string) {
	return new HttpRequestError(detail, { status, body: { detail, type } })
}

describe('isMissingToolError', () => {
	it('knows the node saying a program is nowhere, whatever the wording', () => {
		const type = 'urn:mediary:problem:tool-missing'

		expect(isMissingToolError(failure(428, 'mpv was not found: install mpv', type))).toBe(true)
		expect(isMissingToolError(failure(428, 'the player is not installed', type))).toBe(true)
	})

	it('does not read the wording, so a message that merely says so is not enough', () => {
		expect(isMissingToolError(failure(428, 'mpv was not found: install mpv'))).toBe(false)
	})

	it('leaves other preconditions alone', () => {
		expect(isMissingToolError(failure(428, 'transcoding is turned off on this node'))).toBe(false)
		expect(isMissingToolError(failure(404, 'file 3 was not found'))).toBe(false)
		expect(isMissingToolError(failure(428, 'x', 'urn:mediary:problem:setup-required'))).toBe(false)
		expect(isMissingToolError(null)).toBe(false)
	})
})
