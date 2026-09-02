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

/**
 * Who is signed in to the cloud.
 *
 * The flow is the one the previous client settled on — request events in,
 * an `authenticated` announcement out, nothing in between that knows about
 * routes or toasts — with two things deliberately left out of it:
 *
 *  - the session identifier, which stays in `infrastructure/cloud` because
 *    that is what puts it on the wire (two copies of a credential is how one
 *    of them goes stale);
 *  - every redirect. The old model called `router.push` from inside itself,
 *    which is why it could not be rendered anywhere but its own page. Here the
 *    events are the whole output and the pages decide what they mean.
 *
 * Signed out is a normal state, not an error: the node, the library and the
 * player all work without an account (TZ §5.1). Nothing here is a gate.
 */

/** The account as the server currently sees it — refetched, not derived. */
export const accountQuery = createQuery({ effect: fetchAccountFx, name: 'account' })

/**
 * Which providers this deployment actually offers, which is a property of the
 * cloud rather than of the client: a build that hardcoded "Google" would show a
 * button that answers 404 on a deployment without credentials for it.
 */
export const oauthProvidersQuery = createQuery({ effect: fetchOAuthProvidersFx, name: 'oauthProviders' })

export const sessionModel = atom(() => {
	// ── Input ───────────────────────────────────────────────────────────────
	const signInRequested = createEvent<LoginInput>()
	const signUpRequested = createEvent<RegisterInput>()
	const signOutRequested = createEvent()
	const accountRefreshRequested = createEvent()
	const oauthRequested = createEvent<string>()
	const emailVerificationRequested = createEvent()
	const emailConfirmationRequested = createEvent<ConfirmEmailInput>()

	// ── Output ──────────────────────────────────────────────────────────────
	/** Fires once per established session. Pages listen to navigate. */
	const authenticated = createEvent<Account>()
	/** Fires once per ended session, whether the user asked or the server did. */
	const signedOut = createEvent()
	/** The server rejected the credential we were holding. */
	const sessionExpired = createEvent()
	/** Fires once the address on the account has been confirmed. */
	const emailVerified = createEvent<Account>()

	// ── State ───────────────────────────────────────────────────────────────
	const $account = createStore<Account | null>(null)
	const $isAuthenticated = $account.map(account => account !== null)
	const $pending = combine(signInFx.pending, signUpFx.pending, (signIn, signUp) => signIn || signUp)

	/**
	 * The wire failures, passed through unchanged. Turning `HttpRequestError`
	 * into something a form can render is the form's job — the entity knows what
	 * the server said, not which input the user is looking at.
	 */
	const signInFailed = signInFx.failData
	const signUpFailed = signUpFx.failData
	const emailConfirmationFailed = confirmEmailFx.failData
	const emailVerificationFailed = sendEmailVerificationFx.failData

	/** Internal: a fresh `{ token, user }` pair, from either credential flow. */
	const sessionEstablished = createEvent<Session>()

	sample({ clock: signInRequested, target: signInFx })
	sample({ clock: signUpRequested, target: signUpFx })
	sample({ clock: [signInFx.doneData, signUpFx.doneData], target: sessionEstablished })

	// The token goes to the wire before the account is announced: a page that
	// reacts to `authenticated` by fetching something must find the credential
	// already in place.
	sessionEstablished.watch(session => setCloudSession(session.token))
	sample({ clock: sessionEstablished, fn: session => session.user, target: authenticated })

	// ── OAuth ───────────────────────────────────────────────────────────────
	// Three steps that must stay one scenario: the cloud issues a consent URL,
	// the shell shows it and catches the redirect, the cloud exchanges what came
	// back. The provider is carried in a store rather than threaded through the
	// payloads, because the middle step goes through the preload bridge and
	// comes back knowing only `{ code, state }`.
	const $oauthProvider = createStore<string | null>(null)

	/** Any of the three steps refusing. Closing the window is not one of them. */
	const oauthFailed = createEvent<Error>()

	/** The user closed the consent window: nothing failed, nothing happened. */
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

	// ── Email confirmation ──────────────────────────────────────────────────
	// Part of the account rather than of signing in: registration already hands
	// out a session, and an unconfirmed address costs the user nothing until a
	// feature asks for one.
	sample({ clock: emailVerificationRequested, target: sendEmailVerificationFx })
	sample({ clock: emailConfirmationRequested, target: confirmEmailFx })
	sample({ clock: confirmEmailFx.doneData, target: emailVerified })

	// ── Sign out ────────────────────────────────────────────────────────────
	sample({ clock: signOutRequested, target: [signOutFx, signedOut] })

	// Two clocks on purpose. `$account` clears the moment the user clicks, so
	// the UI never lags behind the intent, but the identifier stays until the
	// request that revokes it has been sent — dropping it first would send
	// `DELETE /sessions/current` with no credential and leave the session alive
	// on the server until its TTL. `finally` rather than `done`: a logout that
	// fails server-side still signs the user out here.
	signOutFx.finally.watch(() => setCloudSession(null))

	// ── Expiry ──────────────────────────────────────────────────────────────
	// A 401 on any request that carried a credential means the session is gone.
	// The guard keeps this quiet for anonymous browsing, where 401 is routine.
	sample({ clock: unauthorized, filter: () => hasCloudSession(), target: sessionExpired })
	sessionExpired.watch(() => setCloudSession(null))
	sample({ clock: sessionExpired, target: signedOut })

	$account
		.on(authenticated, (_, account) => account)
		.on(emailVerified, (_, account) => account)
		.reset(signedOut)

	// ── Refresh ─────────────────────────────────────────────────────────────
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
