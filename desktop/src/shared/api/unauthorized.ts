import { createEvent } from 'effector'

/**
 * Fired when a request that carried a credential came back 401.
 *
 * `shared/api` reports the fact and stops there: what to do about a dead
 * session — clear the account, show a prompt, send the user to sign-in — is a
 * decision for whoever owns the session, and the request layer has no business
 * knowing the routes.
 *
 * On the previous client this was a `window.location.assign` inside the fetch
 * wrapper, guarded by a list of public paths. That guard needed editing every
 * time a route was added, which is what an inverted dependency costs.
 */
export const unauthorized = createEvent<{ url: string }>()
