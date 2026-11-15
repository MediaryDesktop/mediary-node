import { describe, expect, it } from 'vitest'

import { HttpRequestError } from '@shared/api'

import { isMissingBookFolderError } from './missing-folder'

const failure = (detail: string, type?: string) =>
	new HttpRequestError(detail, { status: 428, body: { detail, type } })

describe('isMissingBookFolderError', () => {
	it('knows the node asking for a folder for books, whatever the wording', () => {
		const type = 'urn:mediary:problem:books-folder-missing'

		expect(isMissingBookFolderError(failure('choose a library folder for books first', type))).toBe(true)
		expect(isMissingBookFolderError(failure('pick a place to keep books', type))).toBe(true)
	})

	it('is not fooled by wording alone, nor by another precondition', () => {
		expect(isMissingBookFolderError(failure('choose a library folder for books first'))).toBe(false)
		expect(isMissingBookFolderError(failure('x', 'urn:mediary:problem:tool-missing'))).toBe(false)
		expect(isMissingBookFolderError(null)).toBe(false)
	})
})
