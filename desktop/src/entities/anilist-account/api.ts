import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type AniListSession = NodeSchemas['SessionOutputBody']
export type AniListAccount = NodeSchemas['Account']

const CONNECT_TIMEOUT_MS = 30_000

export const fetchAniListSessionFx = createNodeRequestFx<void, AniListSession>({ url: '/v1/anilist/session' })

export const connectAniListFx = createNodeRequestFx<string, AniListAccount>(accessToken => ({
	url: '/v1/anilist/session',
	method: 'PUT',
	body: { access_token: accessToken },
	timeout: CONNECT_TIMEOUT_MS
}))

export const disconnectAniListFx = createNodeRequestFx<void, void>({
	url: '/v1/anilist/session',
	method: 'DELETE'
})
