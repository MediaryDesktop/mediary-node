/**
 * The connection to the Mediary cloud.
 *
 * Separate from `core/node` rather than merged behind one façade, because the
 * two differ in every way that matters: the cloud is remote, multi-tenant, rate
 * limited and authenticated with a user session, while the node is local,
 * single-user and authenticated with a process token. More importantly they
 * fail independently — the catalog must render when the node is dead, and the
 * player must work when the cloud is unreachable. A shared client would have to
 * branch on all of that at every call site.
 *
 * What is *not* here: the catalog itself. Fetching and modelling media is
 * `modules/media` — this package only knows how to reach the server.
 */

export { cloudFetch, hasCloudSession, setCloudSession } from './client'

export type { CloudSchemas, CloudOperation, CloudResponse } from './schema'
