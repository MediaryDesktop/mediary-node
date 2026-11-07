import { describe, expect, it } from 'vitest'

import { answersOutOfOrder } from '@shared/lib/testing/answers-out-of-order'

import { fetchMangaChaptersFx, fetchMangaLinksFx, searchMangaSourceFx } from '../api/api'

import { mangaChaptersQuery, mangaLinksQuery, mangaSearchQuery } from './model'

describe('a slow answer to an older question', () => {
	it('does not replace the chapters of the title opened since', async () => {
		const scope = await answersOutOfOrder(
			mangaChaptersQuery,
			fetchMangaChaptersFx,
			['anilist:1', 'anilist:2'],
			params => ({ for: params }) as never
		)

		expect(scope.getState(mangaChaptersQuery.$data)).toEqual({ for: 'anilist:2' })
	})

	it('does not replace the links of the title opened since', async () => {
		const scope = await answersOutOfOrder(
			mangaLinksQuery,
			fetchMangaLinksFx,
			['anilist:1', 'anilist:2'],
			params => ({ for: params }) as never
		)

		expect(scope.getState(mangaLinksQuery.$data)).toEqual({ for: 'anilist:2' })
	})

	it('does not replace the results of the search typed since', async () => {
		const scope = await answersOutOfOrder(
			mangaSearchQuery,
			searchMangaSourceFx,
			[{ query: 'ber' } as never, { query: 'berserk' } as never],
			params => ({ for: params }) as never
		)

		expect(scope.getState(mangaSearchQuery.$data)).toEqual({ for: { query: 'berserk' } as never })
	})
})
