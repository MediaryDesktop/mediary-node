import { shell } from 'electron'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import {
	OAUTH_CALLBACK_PATH,
	type OAuthAuthorization,
	type OAuthListener,
	type OAuthRedirect
} from '../shared/oauth.js'

const LISTEN_HOST = '127.0.0.1'
const AUTHORIZE_TIMEOUT_MS = 5 * 60_000

interface PendingFlow {
	server: Server
	port: number
	resolve: ((authorization: OAuthAuthorization) => void) | null
	reject: ((error: Error) => void) | null
	redirect: OAuthRedirect | null
	failure: Error | null
	timer: NodeJS.Timeout | null
}

let pending: PendingFlow | null = null

function page(title: string, message: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d10;color:#e8e8ec;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:32rem;padding:2rem;text-align:center}
h1{font-size:1.25rem;margin:0 0 .5rem}
p{margin:0;color:#a0a0ab}
</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`
}

function respond(response: ServerResponse, body: string): void {
	response.writeHead(200, {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-store'
	})
	response.end(body)
}

function close(flow: PendingFlow): void {
	if (flow.timer) {
		clearTimeout(flow.timer)
		flow.timer = null
	}

	flow.server.close()
	flow.server.closeAllConnections()

	if (pending === flow) {
		pending = null
	}
}

function deliver(flow: PendingFlow): void {
	if (!flow.resolve || !flow.reject) {
		return
	}

	const { resolve, reject } = flow

	flow.resolve = null
	flow.reject = null

	close(flow)

	if (flow.failure) {
		reject(flow.failure)
		return
	}

	resolve(flow.redirect ?? { cancelled: true })
}

export function releaseOAuthListener(): void {
	if (pending) {
		close(pending)
	}
}

export async function prepareOAuth(): Promise<OAuthListener> {
	releaseOAuthListener()

	const server = createServer()

	const flow: PendingFlow = {
		server,
		port: 0,
		resolve: null,
		reject: null,
		redirect: null,
		failure: null,
		timer: null
	}

	server.on('request', (request, response) => {
		const url = new URL(request.url ?? '/', `http://${LISTEN_HOST}:${flow.port}`)

		if (url.pathname !== OAUTH_CALLBACK_PATH) {
			response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
			response.end('not found')
			return
		}

		const failure = url.searchParams.get('error')

		if (failure) {
			flow.failure = new Error(`the provider refused the sign-in: ${failure}`)
			respond(response, page('Sign-in refused', 'You can close this tab and try again.'))
			deliver(flow)
			return
		}

		const code = url.searchParams.get('code')
		const state = url.searchParams.get('state')

		if (!code || !state) {
			flow.failure = new Error('the redirect carried no authorization code')
			respond(response, page('Something went wrong', 'You can close this tab and try again.'))
			deliver(flow)
			return
		}

		flow.redirect = { code, state }
		respond(response, page('You are signed in', 'You can close this tab and return to Mediary.'))
		deliver(flow)
	})

	pending = flow

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject)
		server.listen(0, LISTEN_HOST, () => {
			server.off('error', reject)
			resolve()
		})
	})

	const address = server.address() as AddressInfo | null

	if (!address) {
		close(flow)
		throw new Error('the loopback listener reported no address')
	}

	flow.port = address.port

	return { callbackPort: address.port }
}

export async function authorizeOAuth(consentUrl: string): Promise<OAuthAuthorization> {
	const flow = pending

	if (!flow) {
		throw new Error('oauth: no listener is waiting; call prepare first')
	}

	const consent = new URL(consentUrl)

	if (consent.protocol !== 'https:') {
		close(flow)
		throw new Error('the consent URL must be https')
	}

	const redirect = consent.searchParams.get('redirect_uri')

	if (redirect !== `http://${LISTEN_HOST}:${flow.port}${OAUTH_CALLBACK_PATH}`) {
		close(flow)
		throw new Error('the consent URL does not point back at this listener')
	}

	return new Promise<OAuthAuthorization>((resolve, reject) => {
		flow.resolve = resolve
		flow.reject = reject

		flow.timer = setTimeout(() => {
			flow.failure = null
			flow.redirect = null
			deliver(flow)
		}, AUTHORIZE_TIMEOUT_MS)

		shell.openExternal(consent.toString()).catch((error: unknown) => {
			flow.failure = error instanceof Error ? error : new Error(String(error))
			deliver(flow)
		})
	})
}
