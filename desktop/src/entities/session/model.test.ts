import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchAccountFx, signOutFx } from './api'
import type { Account } from './api'
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
