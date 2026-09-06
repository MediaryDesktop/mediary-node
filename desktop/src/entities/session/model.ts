import { createQuery } from '@farfetched/core'
import { combine, createEffect, createEvent, createStore, sample } from 'effector'
import { once } from 'patronum'

import { unauthorized } from '@shared/api'
import type { StoredSession } from '@shared/bridge'
import { atom } from '@shared/factory'

import {
	authorizeOAuthFx,
	hasCloudToken,
	prepareOAuthFx,
	releaseOAuthFx,
	setCloudToken,
	wasCancelled
} from '@infra/cloud'
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

export function landingRoute(account: Account) {
	return account.email_verified ? '/' : '/verify-email'
}

export const oauthProvidersQuery = createQuery({ effect: fetchOAuthProvidersFx, name: 'oauthProviders' })

const readSessionFx = createEffect<void, StoredSession | null>(() => window.mediary.session.read())

const writeSessionFx = createEffect<StoredSession, void>(session => window.mediary.session.write(session))

function storedAccount(session: StoredSession | null): Account | null {
	const account = session?.account

	if (typeof account !== 'object' || account === null || !('id' in account)) {
		return null
	}

	return account as Account
}

export const sessionModel = atom(() => {
	const appStarted = createEvent()
	const signInRequested = createEvent<LoginInput>()
	const signUpRequested = createEvent<RegisterInput>()
	const signOutRequested = createEvent()
	const accountRefreshRequested = createEvent()
	const oauthRequested = createEvent<string>()
	const emailVerificationRequested = createEvent()
	const emailConfirmationRequested = createEvent<ConfirmEmailInput>()

	const authenticated = createEvent<Account>()
	const emailVerified = createEvent<Account>()
	const restored = createEvent<Account>()

	const signedOut = createEvent()

	const cloudSessionLost = createEvent()

	const sessionEstablished = createEvent<Session>()

	const $token = createStore<string | null>(null)
	const $account = createStore<Account | null>(null)

	const $restoring = createStore(true)
	const $codeExpiresAt = createStore<string | null>(null)
	const $verificationCodeSent = createStore(false)

	const $hasCloudSession = $token.map(token => token !== null)
	const $isAuthenticated = $account.map(account => account !== null)
	const $pending = combine(signInFx.pending, signUpFx.pending, (signIn, signUp) => signIn || signUp)

	$token.watch(setCloudToken)

	const signInFailed = signInFx.failData
	const signUpFailed = signUpFx.failData
	const emailConfirmationFailed = confirmEmailFx.failData
	const emailVerificationFailed = sendEmailVerificationFx.failData

	sample({ clock: once(appStarted), target: readSessionFx })

	$token.on(readSessionFx.doneData, (_, session) => session?.token ?? null)
	$account.on(readSessionFx.doneData, (_, session) => storedAccount(session))

	sample({
		clock: readSessionFx.doneData,
		filter: session => Boolean(session?.token),
		target: accountQuery.start
	})

	sample({
		clock: readSessionFx.doneData,
		filter: session => !session?.token,
		fn: () => false,
		target: $restoring
	})

	sample({ clock: readSessionFx.failData, fn: () => false, target: $restoring })
	sample({ clock: accountQuery.finished.finally, fn: () => false, target: $restoring })
	sample({ clock: accountQuery.finished.success, fn: ({ result }) => result, target: restored })

	sample({ clock: signInRequested, target: signInFx })
	sample({ clock: signUpRequested, target: signUpFx })
	sample({ clock: [signInFx.doneData, signUpFx.doneData], target: sessionEstablished })

	$token.on(sessionEstablished, (_, session) => session.token)
	sample({ clock: sessionEstablished, fn: session => session.user, target: authenticated })

	const $oauthProvider = createStore<string | null>(null)
	const oauthFailed = createEvent<Error>()
	const oauthCancelled = createEvent()

	sample({ clock: oauthRequested, target: prepareOAuthFx })

	sample({
		clock: prepareOAuthFx.doneData,
		source: $oauthProvider,
		filter: (provider: string | null): provider is string => provider !== null,
		fn: (provider, listener) => ({ provider, callbackPort: listener.callbackPort }),
		target: startOAuthFx
	})

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
		clock: [
			prepareOAuthFx.failData,
			startOAuthFx.failData,
			authorizeOAuthFx.failData,
			completeOAuthFx.failData
		],
		target: oauthFailed
	})

	sample({ clock: [startOAuthFx.failData, oauthCancelled], target: releaseOAuthFx })

	$oauthProvider
		.on(oauthRequested, (_, provider) => provider)
		.reset(sessionEstablished, oauthFailed, oauthCancelled)

	sample({ clock: emailVerificationRequested, target: sendEmailVerificationFx })
	sample({ clock: emailConfirmationRequested, target: confirmEmailFx })
	sample({ clock: confirmEmailFx.doneData, target: emailVerified })

	sample({ clock: signOutRequested, target: signOutFx })
	sample({ clock: signOutFx.finally, target: signedOut })

	sample({ clock: unauthorized, filter: () => hasCloudToken(), target: cloudSessionLost })

	$token.on(cloudSessionLost, () => null).reset(signedOut)
	$account.on([authenticated, emailVerified, restored], (_, account) => account).reset(signedOut)

	$verificationCodeSent
		.on([signUpFx.doneData, emailVerificationRequested], () => true)
		.reset(signedOut, emailVerified)

	$codeExpiresAt
		.on(sendEmailVerificationFx.doneData, (_, accepted) => accepted.expires_at)
		.reset(signedOut, emailVerified)

	const $stored = combine({ token: $token, account: $account })

	sample({ clock: $stored.updates, target: writeSessionFx })

	sample({ clock: accountRefreshRequested, target: accountQuery.start })

	const settled = new Promise<void>(resolve => {
		const stop = $restoring.watch(restoring => {
			if (restoring) {
				return
			}

			stop()
			resolve()
		})
	})

	return {
		settled,

		appStarted,
		signInRequested,
		signUpRequested,
		signOutRequested,
		accountRefreshRequested,
		oauthRequested,
		emailVerificationRequested,
		emailConfirmationRequested,

		authenticated,
		restored,
		signedOut,
		cloudSessionLost,
		signInFailed,
		signUpFailed,
		oauthFailed,
		oauthCancelled,
		emailVerified,
		emailConfirmationFailed,
		emailVerificationFailed,

		$account,
		$isAuthenticated,
		$hasCloudSession,
		$restoring,
		$codeExpiresAt,
		$verificationCodeSent,
		$pending,
		$signInPending: signInFx.pending,
		$signUpPending: signUpFx.pending,
		$oauthProvider,
		$emailConfirmationPending: confirmEmailFx.pending,
		$emailVerificationPending: sendEmailVerificationFx.pending
	}
})

export interface ResolvedSession {
	account: Account | null
	linked: boolean
}

export async function resolveSession(): Promise<ResolvedSession> {
	sessionModel.appStarted()

	await sessionModel.settled

	return {
		account: sessionModel.$account.getState(),
		linked: sessionModel.$hasCloudSession.getState()
	}
}
