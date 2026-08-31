import { ofetch } from 'ofetch'

/**
 * HTTP client for the Mediary cloud — kept separate from the node client
 * since the two differ in almost everything: remote vs local, session vs
 * process token. Cache policy differs too; see desktop-implementation-plan.md.
 */

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_URL ?? 'http://localhost:8080'

/**
 * The current session identifier — an opaque server-side Redis session, not a
 * JWT, sent as a header since this isn't a browser with a cookie jar. Held in
 * memory only, so a restart costs one sign-in rather than a credential on disk.
 */
let sessionId: string | null = null

/** Called by the auth module after sign-in, and with null on sign-out. */
export function setCloudSession(id: string | null): void {
	sessionId = id
}

/** True when the renderer believes it has a session. */
export function hasCloudSession(): boolean {
	return sessionId !== null
}

export const cloudFetch = ofetch.create({
	baseURL: CLOUD_BASE_URL,
	retry: 1,
	retryDelay: 500,
	onRequest({ options }) {
		if (sessionId) {
			options.headers.set('Authorization', `Bearer ${sessionId}`)
		}
	}
})
