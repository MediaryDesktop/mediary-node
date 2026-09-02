import { createEvent, createStore, sample } from 'effector'
import { once } from 'patronum'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'

import { oauthProvidersQuery, sessionModel } from '@entities/session'

import { readLastProvider, storeLastProvider } from '../lib/last-provider'
import { providerLabel } from '../lib/providers'

/**
 * The provider buttons: which ones to draw, which one this machine used last,
 * and what to say when consent does not come back.
 *
 * Signing in is `sessionModel.oauthRequested` — three steps across two
 * processes that end in a session, which is the entity's business. What stays
 * here is the part that belongs to the screen.
 */
export const oauthPanel = atom(() => {
	const mounted = createEvent()
	const providerChosen = createEvent<string>()

	// Once per run: the list changes when the deployment is reconfigured, which
	// is not something to re-ask on every visit to the screen.
	sample({ clock: once(mounted), target: oauthProvidersQuery.start })

	const $providers = oauthProvidersQuery.$data.map(data => data?.providers ?? [])

	const $lastUsed = createStore<string | null>(readLastProvider()).on(
		providerChosen,
		(_, provider) => provider
	)

	// Remembered before the flow can fail, on purpose: a user who closed the
	// window by mistake is still a user whose next attempt is that provider.
	providerChosen.watch(storeLastProvider)

	const $failure = createStore<string | null>(null).reset(
		providerChosen,
		sessionModel.authenticated,
		sessionModel.oauthCancelled
	)

	sample({
		clock: sessionModel.oauthFailed,
		source: $lastUsed,
		// The cloud's own sentence when it wrote one; ours otherwise. Nothing the
		// shell says about a consent window is written for a user to read.
		fn: (provider, error) =>
			error instanceof HttpRequestError && error.body?.detail
				? error.body.detail
				: translate('auth.providers.failed', { provider: providerLabel(provider ?? '') }),
		target: $failure
	})

	sample({ clock: providerChosen, target: sessionModel.oauthRequested })

	return {
		mounted,
		providerChosen,
		$providers,
		$lastUsed,
		$failure,
		$pending: sessionModel.$oauthProvider
	}
})
