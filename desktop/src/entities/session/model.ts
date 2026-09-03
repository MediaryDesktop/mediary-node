import { createQuery } from '@farfetched/core'
import { combine, createEvent, createStore, sample } from 'effector'

import { unauthorized } from '@shared/api'
import { atom } from '@shared/factory'

import { authorizeOAuthFx, hasCloudSession, setCloudSession, wasCancelled } from '@infra/cloud'
import type { OAuthRedirect } from '@infra/cloud'

import {
	completeOAuthFx,
	confirmEmailFx,
	fetchAccountFx,
	fetchOAuthProvidersFx,
	sendEmailVerificationFx,
	signInFx,
	signOutFx,
	signUpFx,
	startOAuthFx
} from './api'
import type { Account, ConfirmEmailInput, LoginInput, RegisterInput, Session } from './api'

export const accountQuery = createQuery({ effect: fetchAccountFx, name: 'account' })

export const oauthProvidersQuery = createQuery({ effect: fetchOAuthProvidersFx, name: 'oauthProviders' })

export const sessionModel = atom(() => {
	const signInRequested = createEvent<LoginInput>()
	const signUpRequested = createEvent<RegisterInput>()
	const signOutRequested = createEvent()
	const accountRefreshRequested = createEvent()
	const oauthRequested = createEvent<string>()
	const emailVerificationRequested = createEvent()
	const emailConfirmationRequested = createEvent<ConfirmEmailInput>()

	const authenticated = createEvent<Account>()

	const signedOut = createEvent()

	const sessionExpired = createEvent()

	const emailVerified = createEvent<Account>()

	const $account = createStore<Account | null>(null)
	const $isAuthenticated = $account.map(account => account !== null)
	const $pending = combine(signInFx.pending, signUpFx.pending, (signIn, signUp) => signIn || signUp)

	const signInFailed = signInFx.failData
	const signUpFailed = signUpFx.failData
	const emailConfirmationFailed = confirmEmailFx.failData
	const emailVerificationFailed = sendEmailVerificationFx.failData

	const sessionEstablished = createEvent<Session>()

	sample({ clock: signInRequested, target: signInFx })
	sample({ clock: signUpRequested, target: signUpFx })
	sample({ clock: [signInFx.doneData, signUpFx.doneData], target: sessionEstablished })

	sessionEstablished.watch(session => setCloudSession(session.token))
	sample({ clock: sessionEstablished, fn: session => session.user, target: authenticated })

	const $oauthProvider = createStore<string | null>(null)

	const oauthFailed = createEvent<Error>()

	const oauthCancelled = createEvent()

	sample({ clock: oauthRequested, target: startOAuthFx })
	sample({ clock: startOAuthFx.doneData, fn: ({ url }) => url, target: authorizeOAuthFx })
	sample({ clock: authorizeOAuthFx.doneData, filter: wasCancelled, target: oauthCancelled })

	const redirected = sample({
		clock: authorizeOAuthFx.doneData,
		filter: (authorization): authorization is OAuthRedirect => !wasCancelled(authorization)
	})

	sample({
		clock: redirected,
		source: $oauthProvider,
		filter: (provider: string | null): provider is string => provider !== null,
		fn: (provider, redirect) => ({ provider, ...redirect }),
		target: completeOAuthFx
	})
	sample({ clock: completeOAuthFx.doneData, target: sessionEstablished })
	sample({
		clock: [startOAuthFx.failData, authorizeOAuthFx.failData, completeOAuthFx.failData],
		target: oauthFailed
	})

	$oauthProvider
		.on(oauthRequested, (_, provider) => provider)
		.reset(sessionEstablished, oauthFailed, oauthCancelled)

	sample({ clock: emailVerificationRequested, target: sendEmailVerificationFx })
	sample({ clock: emailConfirmationRequested, target: confirmEmailFx })
	sample({ clock: confirmEmailFx.doneData, target: emailVerified })

	sample({ clock: signOutRequested, target: [signOutFx, signedOut] })

	signOutFx.finally.watch(() => setCloudSession(null))

	sample({ clock: unauthorized, filter: () => hasCloudSession(), target: sessionExpired })
	sessionExpired.watch(() => setCloudSession(null))
	sample({ clock: sessionExpired, target: signedOut })

	$account
		.on(authenticated, (_, account) => account)
		.on(emailVerified, (_, account) => account)
		.reset(signedOut)

	sample({ clock: accountRefreshRequested, target: accountQuery.start })
	$account.on(accountQuery.finished.success, (_, { result }) => result)

	return {
		signInRequested,
		signUpRequested,
		signOutRequested,
		accountRefreshRequested,
		oauthRequested,
		emailVerificationRequested,
		emailConfirmationRequested,

		authenticated,
		signedOut,
		sessionExpired,
		signInFailed,
		signUpFailed,
		oauthFailed,
		oauthCancelled,
		emailVerified,
		emailConfirmationFailed,
		emailVerificationFailed,

		$account,
		$isAuthenticated,
		$pending,
		$signInPending: signInFx.pending,
		$signUpPending: signUpFx.pending,
		$oauthProvider,
		$emailConfirmationPending: confirmEmailFx.pending,
		$emailVerificationPending: sendEmailVerificationFx.pending
	}
})
