import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchAccountFx, signOutFx, startOAuthFx } from '../api/api'
import type { Account } from '../api/api'
import { sessionModel } from './model'

const ACCOUNT: Account = {
	id: 'acc-1',
	email: 'lukas@example.test',
	display_name: 'Lukas',
	email_verified: true
} as Account

const stored = { token: 'stored-token', account: ACCOUNT }

const bridge = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))

beforeEach(() => {
	bridge.read.mockReset()
	bridge.write.mockReset()
	bridge.write.mockResolvedValue(undefined)

	window.mediary.session.read = bridge.read
	window.mediary.session.write = bridge.write
})

describe('session restore', () => {
	it('keeps the cached profile when the cloud cannot be reached', async () => {
		bridge.read.mockResolvedValue(stored)

		const scope = fork({
			handlers: [[fetchAccountFx, () => Promise.reject(new Error('offline'))]]
		})

		await allSettled(sessionModel.appStarted, { scope })

		expect(scope.getState(sessionModel.$account)).toEqual(ACCOUNT)
		expect(scope.getState(sessionModel.$hasCloudSession)).toBe(true)
		expect(scope.getState(sessionModel.$restoring)).toBe(false)
	})

	it('refreshes the profile when the cloud answers', async () => {
		const fresher = { ...ACCOUNT, display_name: 'Lukas Renamed' }

		bridge.read.mockResolvedValue(stored)

		const scope = fork({ handlers: [[fetchAccountFx, () => Promise.resolve(fresher)]] })

		await allSettled(sessionModel.appStarted, { scope })

		expect(scope.getState(sessionModel.$account)).toEqual(fresher)
		expect(bridge.write).toHaveBeenCalledWith({ token: 'stored-token', account: fresher })
	})

	it('starts anonymous when nothing was ever stored', async () => {
		bridge.read.mockResolvedValue(null)

		const scope = fork()

		await allSettled(sessionModel.appStarted, { scope })

		expect(scope.getState(sessionModel.$account)).toBeNull()
		expect(scope.getState(sessionModel.$hasCloudSession)).toBe(false)
		expect(scope.getState(sessionModel.$restoring)).toBe(false)
	})
})

describe('losing the cloud session', () => {
	it('drops the token but keeps the identity, so local content stays reachable', async () => {
		bridge.read.mockResolvedValue(stored)

		const scope = fork({ handlers: [[fetchAccountFx, () => Promise.resolve(ACCOUNT)]] })

		await allSettled(sessionModel.appStarted, { scope })
		await allSettled(sessionModel.cloudSessionLost, { scope })

		expect(scope.getState(sessionModel.$hasCloudSession)).toBe(false)
		expect(scope.getState(sessionModel.$account)).toEqual(ACCOUNT)
		expect(bridge.write).toHaveBeenLastCalledWith({ token: null, account: ACCOUNT })
	})
})

describe('signing out', () => {
	it('forgets both the token and the identity', async () => {
		bridge.read.mockResolvedValue(stored)

		const scope = fork({
			handlers: [
				[fetchAccountFx, () => Promise.resolve(ACCOUNT)],
				[signOutFx, () => Promise.resolve(undefined)]
			]
		})

		await allSettled(sessionModel.appStarted, { scope })
		await allSettled(sessionModel.signOutRequested, { scope })

		expect(scope.getState(sessionModel.$hasCloudSession)).toBe(false)
		expect(scope.getState(sessionModel.$account)).toBeNull()
		expect(bridge.write).toHaveBeenLastCalledWith({ token: null, account: null })
	})
})

describe('an OAuth flow the browser never finishes', () => {
	const CONSENT = { url: 'https://provider.test/consent?redirect_uri=x' }

	it('frees the provider buttons once the authorization comes back cancelled', async () => {
		const scope = fork({ handlers: [[startOAuthFx, () => Promise.resolve(CONSENT)]] })

		await allSettled(sessionModel.oauthRequested, { scope, params: 'github' })

		expect(scope.getState(sessionModel.$oauthProvider)).toBeNull()
	})

	it('asks the main process to release the loopback listener when cancelled', async () => {
		const release = vi.fn().mockResolvedValue(undefined)

		window.mediary.oauth.release = release

		const scope = fork()

		await allSettled(sessionModel.oauthCancelRequested, { scope })

		expect(release).toHaveBeenCalledTimes(1)
	})

	it('stops reporting starting once the browser has the consent page', async () => {
		let releaseStart: ((consent: typeof CONSENT) => void) | undefined

		const scope = fork({
			handlers: [
				[
					startOAuthFx,
					() =>
						new Promise<typeof CONSENT>(resolve => {
							releaseStart = resolve
						})
				]
			]
		})

		const flow = allSettled(sessionModel.oauthRequested, { scope, params: 'github' })

		await vi.waitFor(() => {
			expect(scope.getState(sessionModel.$oauthStarting)).toBe(true)
		})

		releaseStart?.(CONSENT)
		await flow

		expect(scope.getState(sessionModel.$oauthStarting)).toBe(false)
		expect(scope.getState(sessionModel.$oauthProvider)).toBeNull()
	})
})
