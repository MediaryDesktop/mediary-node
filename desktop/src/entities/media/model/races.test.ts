import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import {
	fetchMediaDetailsFx,
	fetchMediaEpisodesFx,
	fetchMediaFilterOptionsFx,
	searchManualCoversFx,
	searchMediaFx
} from '../api/api'

import {
	manualCoverSearchQuery,
	mediaDetailsModel,
	mediaDetailsQuery,
	mediaEpisodesQuery,
	mediaFilterOptionsQuery,
	mediaSearchQuery
} from './model'

describe('a slow answer to an older question', () => {
	it('does not replace the details of the title opened since', async () => {
		const scope = await answersOutOfOrder(
			mediaDetailsQuery,
			fetchMediaDetailsFx,
			['anilist:1', 'anilist:2'],
			ref => ({ media: { media_ref: ref } }) as never
		)

		expect(scope.getState(mediaDetailsQuery.$data)).toEqual({ media: { media_ref: 'anilist:2' } })
		expect(scope.getState(mediaDetailsModel.$failedMediaRef)).toBeNull()
		expect(scope.getState(mediaDetailsQuery.$pending)).toBe(false)
	})

	it('does not replace the episodes of the title opened since', async () => {
		const scope = await answersOutOfOrder(
			mediaEpisodesQuery,
			fetchMediaEpisodesFx,
			['anilist:1', 'anilist:2'],
			ref => ({ ref }) as never
		)

		expect(scope.getState(mediaEpisodesQuery.$data)).toEqual({ ref: 'anilist:2' })
	})

	it('does not replace the results of the search typed since', async () => {
		const scope = await answersOutOfOrder(
			mediaSearchQuery,
			searchMediaFx,
			[{ title: 'nar' } as never, { title: 'naruto' } as never],
			query => ({ for: (query as { title: string }).title }) as never
		)

		expect(scope.getState(mediaSearchQuery.$data)).toEqual({ for: 'naruto' })
	})

	it('does not replace the filters of the type chosen since', async () => {
		const scope = await answersOutOfOrder(
			mediaFilterOptionsQuery,
			fetchMediaFilterOptionsFx,
			['ANIME' as never, 'MANGA' as never],
			type => ({ type }) as never
		)

		expect(scope.getState(mediaFilterOptionsQuery.$data)).toEqual({ type: 'MANGA' })
	})

	it('does not replace the covers found for the title typed since', async () => {
		const scope = await answersOutOfOrder(
			manualCoverSearchQuery,
			searchManualCoversFx,
			[{ title: 'Ber' } as never, { title: 'Berserk' } as never],
			search => ({ for: (search as { title: string }).title }) as never
		)

		expect(scope.getState(manualCoverSearchQuery.$data)).toEqual({ for: 'Berserk' })
	})
})
