import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { fetchOAuthProvidersFx } from '@entities/session'

import { oauthPanel } from './oauth'

vi.mock('@shared/ui', () => ({ toast: { error: vi.fn() } }))
vi.mock('@shared/i18n', () => ({ translate: (key: string) => key }))

const LIST = { providers: ['google', 'github'] }

describe('loading the provider list', () => {
	it('asks again every time the screen opens, not once per app run', async () => {
		const answer = vi.fn().mockResolvedValue(LIST)

		const scope = fork({ handlers: [[fetchOAuthProvidersFx, answer]] })

		await allSettled(oauthPanel.mounted, { scope })
		await allSettled(oauthPanel.mounted, { scope })

		expect(answer).toHaveBeenCalledTimes(2)
	})

	it('recovers on its own when the cloud is not up yet', async () => {
		const answer = vi.fn().mockRejectedValueOnce(new Error('connection refused')).mockResolvedValue(LIST)

		const scope = fork({ handlers: [[fetchOAuthProvidersFx, answer]] })

		await allSettled(oauthPanel.mounted, { scope })

		expect(answer.mock.calls.length).toBeGreaterThan(1)
		expect(scope.getState(oauthPanel.$providers)).toEqual(['google', 'github'])
		expect(scope.getState(oauthPanel.$unavailable)).toBe(false)
	})

	it('asks again when the retry link is used', async () => {
		const answer = vi.fn().mockResolvedValue(LIST)

		const scope = fork({ handlers: [[fetchOAuthProvidersFx, answer]] })

		await allSettled(oauthPanel.reloadRequested, { scope })

		expect(answer).toHaveBeenCalledTimes(1)
		expect(scope.getState(oauthPanel.$providers)).toEqual(['google', 'github'])
	})

	it('treats a deployment with no providers as an answer, not a failure', async () => {
		const answer = vi.fn().mockResolvedValue({ providers: [] })

		const scope = fork({ handlers: [[fetchOAuthProvidersFx, answer]] })

		await allSettled(oauthPanel.mounted, { scope })

		expect(answer).toHaveBeenCalledTimes(1)
		expect(scope.getState(oauthPanel.$unavailable)).toBe(false)
	})
})
