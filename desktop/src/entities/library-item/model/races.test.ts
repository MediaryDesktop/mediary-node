import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import { fetchLibraryCandidatesFx, fetchLibraryScanRunFx } from '../api/api'

import { libraryCandidatesQuery, libraryScanRunQuery } from './queries'

describe('a slow answer to an older question', () => {
	it('does not replace the scan run opened since', async () => {
		const scope = await answersOutOfOrder(
			libraryScanRunQuery,
			fetchLibraryScanRunFx,
			[1, 2],
			params => ({ for: params }) as never
		)

		expect(scope.getState(libraryScanRunQuery.$data)).toEqual({ for: 2 })
	})

	it('does not replace the suggestions for the file chosen since', async () => {
		const scope = await answersOutOfOrder(
			libraryCandidatesQuery,
			fetchLibraryCandidatesFx,
			[1, 2],
			params => ({ for: params }) as never
		)

		expect(scope.getState(libraryCandidatesQuery.$data)).toEqual({ for: 2 })
	})
})
