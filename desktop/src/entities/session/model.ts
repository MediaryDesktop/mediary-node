import { createQuery } from '@farfetched/core'
import { combine, createEvent, createStore, sample } from 'effector'

import { unauthorized } from '@shared/api'
import { atom } from '@shared/factory'

import { hasCloudSession, setCloudSession } from '@infra/cloud'

import { fetchAccountFx, signInFx, signOutFx, signUpFx } from './api'
import type { Account, LoginInput, RegisterInput, Session } from './api'

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

export const sessionModel = atom(() => {
	// ── Input ───────────────────────────────────────────────────────────────
	const signInRequested = createEvent<LoginInput>()
	const signUpRequested = createEvent<RegisterInput>()
	const signOutRequested = createEvent()
	const accountRefreshRequested = createEvent()

	// ── Output ──────────────────────────────────────────────────────────────
	/** Fires once per established session. Pages listen to navigate. */
	const authenticated = createEvent<Account>()
	/** Fires once per ended session, whether the user asked or the server did. */
	const signedOut = createEvent()
	/** The server rejected the credential we were holding. */
	const sessionExpired = createEvent()

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

	$account.on(authenticated, (_, account) => account).reset(signedOut)

	// ── Refresh ─────────────────────────────────────────────────────────────
	sample({ clock: accountRefreshRequested, target: accountQuery.start })
	$account.on(accountQuery.finished.success, (_, { result }) => result)

	return {
		signInRequested,
		signUpRequested,
		signOutRequested,
		accountRefreshRequested,

		authenticated,
		signedOut,
		sessionExpired,
		signInFailed,
		signUpFailed,

		$account,
		$isAuthenticated,
		$pending,
		$signInPending: signInFx.pending,
		$signUpPending: signUpFx.pending
	}
})
