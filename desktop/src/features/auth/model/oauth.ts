import { createEvent, createStore, sample } from 'effector'
import { once } from 'patronum'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'

import { oauthProvidersQuery, sessionModel } from '@entities/session'

import { readLastProvider, storeLastProvider } from '../lib/last-provider'
import { providerLabel } from '../lib/providers'

export const oauthPanel = atom(() => {
	const mounted = createEvent()
	const providerChosen = createEvent<string>()

	sample({ clock: once(mounted), target: oauthProvidersQuery.start })

	const $providers = oauthProvidersQuery.$data.map(data => data?.providers ?? [])

	const $lastUsed = createStore<string | null>(readLastProvider()).on(
		providerChosen,
		(_, provider) => provider
	)

	providerChosen.watch(storeLastProvider)

	const $failure = createStore<string | null>(null).reset(
		providerChosen,
		sessionModel.authenticated,
		sessionModel.oauthCancelled
	)

	sample({
		clock: sessionModel.oauthFailed,
		source: $lastUsed,

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
