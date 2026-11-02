import { createQuery, keepFresh } from '@farfetched/core'
import { createEffect, createEvent, sample } from 'effector'

import type { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'

import { nodeOnline, nodeTopic } from '@infra/node'

import { connectAniListFx, disconnectAniListFx, fetchAniListSessionFx } from '../api/api'

export type AniListConnectFailure = 'rejected' | 'unreachable' | 'unknown'

export const aniListSessionQuery = createQuery({ effect: fetchAniListSessionFx, name: 'anilistSession' })

keepFresh(aniListSessionQuery, { triggers: [nodeTopic('anilist.session')] })

sample({ clock: nodeOnline, target: aniListSessionQuery.start })

const openAuthorizeFx = createEffect<string, void>(authorizeUrl =>
	window.mediary.anilist.openAuthorize(authorizeUrl)
)

function failureOf(error: HttpRequestError): AniListConnectFailure {
	if (error.status === 422) {
		return 'rejected'
	}

	if (error.status === 0 || error.status === 502 || error.status === 503) {
		return 'unreachable'
	}

	return 'unknown'
}

export const aniListAccountModel = atom(() => {
	const authorizeRequested = createEvent()
	const connectRequested = createEvent<string>()
	const disconnectRequested = createEvent()

	const $session = aniListSessionQuery.$data
	const $account = $session.map(session => session?.account ?? null)
	const $connected = $session.map(session => session?.connected ?? false)
	const $authorizeUrl = $session.map(session => session?.authorize_url ?? null)
	const $loaded = $session.map(session => session !== null)

	const $connecting = connectAniListFx.pending
	const $disconnecting = disconnectAniListFx.pending

	// Fires once per failed attempt, for the UI to report as a toast — never a
	// store, so a repeat of the same failure is not silently swallowed.
	const connectFailed = createEvent<AniListConnectFailure>()
	sample({ clock: connectAniListFx.failData, fn: failureOf, target: connectFailed })

	sample({
		clock: authorizeRequested,
		source: $authorizeUrl,
		filter: (authorizeUrl): authorizeUrl is string => authorizeUrl !== null,
		target: openAuthorizeFx
	})

	sample({
		clock: connectRequested,
		filter: accessToken => accessToken.trim().length > 0,
		fn: accessToken => accessToken.trim(),
		target: connectAniListFx
	})

	sample({ clock: disconnectRequested, target: disconnectAniListFx })

	sample({
		clock: [connectAniListFx.done, disconnectAniListFx.done],
		target: aniListSessionQuery.refresh
	})

	return {
		authorizeRequested,
		connectRequested,
		disconnectRequested,
		$account,
		$connected,
		$authorizeUrl,
		$loaded,
		$connecting,
		$disconnecting,
		connectFailed
	}
})
