import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { fetchMediaDetailsFx } from '../api/api'
import type { MediaDetailsResponse } from '../api/api'

import { mediaDetailsModel, mediaPreviewModel } from './model'

function response(mediaRef: string): MediaDetailsResponse {
	return {
		media: { media_ref: mediaRef } as MediaDetailsResponse['media'],
		sources: []
	}
}

describe('media details model', () => {
	it('remembers which title failed and forgets it after a successful load', async () => {
		const fetch = vi.fn((mediaRef: string) =>
			mediaRef === 'anilist:1'
				? Promise.reject(new Error('offline'))
				: Promise.resolve(response(mediaRef))
		)

		const scope = fork({ handlers: [[fetchMediaDetailsFx, fetch]] })

		await allSettled(mediaDetailsModel.detailsRequested, { scope, params: 'anilist:1' })
		expect(scope.getState(mediaDetailsModel.$failedMediaRef)).toBe('anilist:1')

		await allSettled(mediaDetailsModel.detailsRequested, { scope, params: 'anilist:2' })
		expect(scope.getState(mediaDetailsModel.$failedMediaRef)).toBeNull()
		expect(scope.getState(mediaDetailsModel.$data)?.media.media_ref).toBe('anilist:2')
	})
})

describe('media previews', () => {
	it('asks for each title it does not have yet, once', async () => {
		const fetch = vi.fn((mediaRef: string) => Promise.resolve(response(mediaRef)))
		const scope = fork({
			handlers: [[fetchMediaDetailsFx, fetch]]
		})

		await allSettled(mediaPreviewModel.previewsRequested, { scope, params: ['anilist:1', 'anilist:2'] })
		await allSettled(mediaPreviewModel.previewsRequested, { scope, params: ['anilist:2', 'anilist:3'] })

		expect(fetch.mock.calls.map(([ref]) => ref)).toEqual(['anilist:1', 'anilist:2', 'anilist:3'])
		expect(Object.keys(scope.getState(mediaPreviewModel.$previews))).toEqual([
			'anilist:1',
			'anilist:2',
			'anilist:3'
		])
	})
})
