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

export { accountQuery, sessionModel } from './model'

export type { Account, LoginInput, OAuthProviders, RegisterInput, Session } from './api'
