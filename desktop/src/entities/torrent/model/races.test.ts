import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import { fetchTorrentRuleFx } from '../api/api'

import { torrentRuleQuery } from './model'

describe('a slow answer to an older question', () => {
	it('does not replace the rule of the title opened since', async () => {
		const scope = await answersOutOfOrder(
			torrentRuleQuery,
			fetchTorrentRuleFx,
			['anilist:1', 'anilist:2'],
			params => ({ for: params }) as never
		)

		expect(scope.getState(torrentRuleQuery.$data)).toEqual({ for: 'anilist:2' })
	})
})
