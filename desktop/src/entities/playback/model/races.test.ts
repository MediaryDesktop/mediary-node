import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import { fetchPlaybackStreamFx } from '../api/api'

import { playbackStreamQuery } from './model'

describe('a slow answer to an older question', () => {
	it('does not replace the stream of the episode started since', async () => {
		const scope = await answersOutOfOrder(
			playbackStreamQuery,
			fetchPlaybackStreamFx,
			[1, 2],
			params => ({ for: params }) as never
		)

		expect(scope.getState(playbackStreamQuery.$data)).toEqual({ for: 2 })
	})
})
