import { createRequestFx } from '@shared/api'

/**
 * The connection to the Mediary cloud — kept separate from the node client
 * since the two differ in almost everything: remote vs local, session vs
 * process token. Cache policy differs too; see desktop-implementation-plan.md.
 */

/**
 * `127.0.0.1`, not `localhost`: the renderer's CSP (`index.html`) allows
 * `connect-src http://127.0.0.1:*` for loopback traffic and `https:` for the
 * real deployment, and nothing in between — `localhost` resolves to the same
 * machine but is a different origin string, and CSP matches strings, not DNS.
 * A request to `http://localhost:8080` is silently blocked by Chromium before
 * it ever reaches the network.
 */
const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_URL ?? 'http://127.0.0.1:8080'

/**
 * The current session identifier — an opaque server-side Redis session, not a
 * JWT, sent as a header since this isn't a browser with a cookie jar. Held in
 * memory only, so a restart costs one sign-in rather than a credential on disk.
 *
 * It lives here rather than in `entities/session` for the same reason the token
 * is not duplicated anywhere else: the credential belongs to whatever puts it
 * on the wire. Two copies is how one of them goes stale.
 */
let sessionId: string | null = null

/** Called by the session entity after sign-in, and with null on sign-out. */
export function setCloudSession(id: string | null): void {
	sessionId = id
}

/** True when the renderer believes it has a session. */
export function hasCloudSession(): boolean {
	return sessionId !== null
}

/** Every cloud request is declared through this factory. */
export const createCloudRequestFx = createRequestFx({
	baseURL: CLOUD_BASE_URL,
	headers: (): HeadersInit => (sessionId ? { Authorization: `Bearer ${sessionId}` } : {})
})
