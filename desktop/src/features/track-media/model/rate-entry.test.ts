import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { updateTrackerEntryFx } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { rateEntryModel } from './rate-entry'

const NEW_TITLE = { mediaRef: 'tmdb:movie:1', mediaType: 'movie' as const, title: 'Arrival' }

describe('rating a title on no list yet', () => {
	it('opens a blank form named after the title', async () => {
		const scope = fork()

		await allSettled(rateEntryModel.addOpened, { scope, params: NEW_TITLE })

		expect(scope.getState(rateEntryModel.$open)).toBe(true)
		expect(scope.getState(rateEntryModel.$target)).toMatchObject({ title: 'Arrival', entry: null })
		expect(scope.getState(rateEntryModel.$score)).toBe(0)
		expect(scope.getState(rateEntryModel.$dirty)).toBe(false)
	})

	it('sends only the rating, which adds the title, and closes', async () => {
		const update = vi.fn(({ mediaRef }: { mediaRef: string }) =>
			Promise.resolve({ media_ref: mediaRef } as TrackerEntry)
		)
		const scope = fork({ handlers: [[updateTrackerEntryFx, update]] })

		await allSettled(rateEntryModel.addOpened, { scope, params: NEW_TITLE })
		await allSettled(rateEntryModel.scoreChanged, { scope, params: 80 })
		await allSettled(rateEntryModel.submitted, { scope })

		expect(update).toHaveBeenCalledWith({ mediaRef: 'tmdb:movie:1', patch: { score: 80 } })
		expect(scope.getState(rateEntryModel.$open)).toBe(false)
	})
})
