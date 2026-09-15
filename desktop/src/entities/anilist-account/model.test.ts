import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpRequestError } from '@shared/api'

import { connectAniListFx, fetchAniListSessionFx } from './api'
import type { AniListAccount, AniListSession } from './api'
import { aniListAccountModel, aniListSessionQuery } from './model'

const ACCOUNT: AniListAccount = {
	id: 42,
	name: 'lukas',
	site_url: 'https://anilist.co/user/lukas',
	avatar_url: null,
	score_format: 'POINT_10',
	display_adult_content: false
}

const DISCONNECTED: AniListSession = {
	connected: false,
	authorize_url: 'https://anilist.co/api/v2/oauth/authorize?client_id=1&response_type=token'
}

const CONNECTED: AniListSession = { connected: true, account: ACCOUNT }

const openAuthorize = vi.hoisted(() => vi.fn())

beforeEach(() => {
	openAuthorize.mockReset()
	openAuthorize.mockResolvedValue(undefined)
	window.mediary.anilist.openAuthorize = openAuthorize
})

describe('anilist account', () => {
	it('connects with a pasted token and reloads the session', async () => {
		const sessions = [DISCONNECTED, CONNECTED]
		const connect = vi.fn().mockResolvedValue(ACCOUNT)

		const scope = fork({
			handlers: [
				[fetchAniListSessionFx, () => Promise.resolve(sessions.shift())],
				[connectAniListFx, connect]
			]
		})

		await allSettled(aniListSessionQuery.start, { scope })
		expect(scope.getState(aniListAccountModel.$connected)).toBe(false)

		await allSettled(aniListAccountModel.connectRequested, { scope, params: '  pasted-token  ' })

		expect(connect).toHaveBeenCalledWith('pasted-token')
		expect(scope.getState(aniListAccountModel.$connected)).toBe(true)
		expect(scope.getState(aniListAccountModel.$account)).toEqual(ACCOUNT)
	})

	it('reports a token AniList rejected', async () => {
		const scope = fork({
			handlers: [
				[fetchAniListSessionFx, () => Promise.resolve(DISCONNECTED)],
				[connectAniListFx, () => Promise.reject(new HttpRequestError('rejected', { status: 422 }))]
			]
		})

		await allSettled(aniListAccountModel.connectRequested, { scope, params: 'stale' })

		expect(scope.getState(aniListAccountModel.$connectFailure)).toBe('rejected')
	})

	it('ignores a blank token', async () => {
		const connect = vi.fn()

		const scope = fork({ handlers: [[connectAniListFx, connect]] })

		await allSettled(aniListAccountModel.connectRequested, { scope, params: '   ' })

		expect(connect).not.toHaveBeenCalled()
	})

	it('opens AniList only when the node offers an authorize address', async () => {
		const scope = fork({
			handlers: [[fetchAniListSessionFx, () => Promise.resolve({ connected: false })]]
		})

		await allSettled(aniListSessionQuery.start, { scope })
		await allSettled(aniListAccountModel.authorizeRequested, { scope })

		expect(openAuthorize).not.toHaveBeenCalled()

		const configured = fork({
			handlers: [[fetchAniListSessionFx, () => Promise.resolve(DISCONNECTED)]]
		})

		await allSettled(aniListSessionQuery.start, { scope: configured })
		await allSettled(aniListAccountModel.authorizeRequested, { scope: configured })

		expect(openAuthorize).toHaveBeenCalledWith(DISCONNECTED.authorize_url)
	})
})
