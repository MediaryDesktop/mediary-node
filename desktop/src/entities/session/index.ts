/**
 * The session: who is signed in to the cloud, and the requests that change it.
 *
 * An entity owns the *fact*, not the scenario. Forms, their validation and the
 * decision that a fresh session lands on `/` belong to `features/auth` and the
 * pages above it — this slice would look the same if the app signed in through
 * a QR code instead.
 *
 * Pairing a node with the account is a different concept with a different
 * credential (a device token, not a session) and will be its own entity.
 */

export { accountQuery, oauthProvidersQuery, sessionModel } from './model'

/**
 * Password recovery leaves the session alone — it is the one account scenario
 * that runs with nobody signed in — so its two calls are exported as effects
 * for `features/auth` to sequence, rather than as events on a model that would
 * hold no state for them.
 */
export { completePasswordResetFx, requestPasswordResetFx } from './api'

export type {
	Account,
	LoginInput,
	OAuthProviders,
	PasswordResetInput,
	PasswordResetRequest,
	RegisterInput,
	Session
} from './api'
