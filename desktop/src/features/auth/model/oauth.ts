import { createEvent, createStore, sample } from 'effector'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { oauthProvidersQuery, sessionModel } from '@entities/session'

import { providerLabel, readLastProvider, storeLastProvider } from '../lib'

export const oauthPanel = atom(() => {
	const mounted = createEvent()
	const providerChosen = createEvent<string>()
	const cancelled = createEvent()
	const reloadRequested = createEvent()

	sample({ clock: [mounted, reloadRequested], target: oauthProvidersQuery.start })

	const $providers = oauthProvidersQuery.$data.map(data => data?.providers ?? [])
	const $unavailable = oauthProvidersQuery.$error.map(error => error !== null)

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
	sample({ clock: cancelled, target: sessionModel.oauthCancelRequested })

	return {
		mounted,
		providerChosen,
		cancelled,
		reloadRequested,
		$providers,
		$unavailable,
		$lastUsed,
		$pending: sessionModel.$oauthProvider,
		$starting: sessionModel.$oauthStarting
	}
})
