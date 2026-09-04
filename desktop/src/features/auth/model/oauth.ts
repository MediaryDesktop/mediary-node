import { createEvent, createStore, sample } from 'effector'
import { once } from 'patronum'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { oauthProvidersQuery, sessionModel } from '@entities/session'

import { providerLabel, readLastProvider, storeLastProvider } from '../lib'

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

	sample({
		clock: sessionModel.oauthFailed,
		source: $lastUsed,

		fn: (provider, error) =>
			error instanceof HttpRequestError && error.body?.detail
				? error.body.detail
				: translate('auth.providers.failed', { provider: providerLabel(provider ?? '') })
	}).watch(message => toast.error(message))

	sample({ clock: providerChosen, target: sessionModel.oauthRequested })

	return {
		mounted,
		providerChosen,
		$providers,
		$lastUsed,
		$pending: sessionModel.$oauthProvider
	}
})
