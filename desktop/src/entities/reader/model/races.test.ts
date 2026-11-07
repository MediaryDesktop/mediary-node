import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import { fetchBookStateFx, fetchChapterFx } from '../api/api'

import { bookStateQuery, chapterQuery } from './model'

describe('a slow answer to an older question', () => {
	it('does not replace the chapter turned to since', async () => {
		const scope = await answersOutOfOrder(
			chapterQuery,
			fetchChapterFx,
			['ch:1', 'ch:2'],
			params => ({ for: params }) as never
		)

		expect(scope.getState(chapterQuery.$data)).toEqual({ for: 'ch:2' })
	})

	it('does not replace the book opened since', async () => {
		const scope = await answersOutOfOrder(
			bookStateQuery,
			fetchBookStateFx,
			[1, 2],
			params => ({ for: params }) as never
		)

		expect(scope.getState(bookStateQuery.$data)).toEqual({ for: 2 })
	})
})
