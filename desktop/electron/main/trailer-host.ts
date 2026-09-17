import { randomBytes } from 'node:crypto'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

const LISTEN_HOST = '127.0.0.1'

const VIDEO_ID = /^[\w-]{5,24}$/

const CONTROLS_FADE_MS = 3200

let server: Server | null = null
let origin: string | null = null

function framePolicy(nonce: string): string {
	return [
		"default-src 'none'",
		"style-src 'unsafe-inline'",
		`script-src 'nonce-${nonce}' https://www.youtube.com`,
		'frame-src https://www.youtube-nocookie.com https://www.youtube.com'
	].join('; ')
}

function playerPage(id: string, nonce: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:#000}
iframe{--video-width:max(100vw,calc(100vh*16/9));position:absolute;top:50%;left:50%;width:var(--video-width);height:calc(var(--video-width)*27/16);border:0;transform:translate(-50%,-50%);pointer-events:none}
</style></head><body><div id="player"></div><script nonce="${nonce}">
const report = state => parent.postMessage({ source: 'mediary-trailer', state }, '*')
let revealed = false
window.onYouTubeIframeAPIReady = () => {
	new YT.Player('player', {
		host: 'https://www.youtube-nocookie.com',
		videoId: '${id}',
		playerVars: { autoplay: 1, mute: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
		events: {
			onReady: event => { event.target.mute(); event.target.playVideo() },
			onStateChange: event => {
				if (event.data === YT.PlayerState.PLAYING && !revealed) {
					revealed = true
					setTimeout(() => report('playing'), ${CONTROLS_FADE_MS})
				}
				if (event.data === YT.PlayerState.ENDED) report('ended')
			},
			onError: () => report('error')
		}
	})
}
const api = document.createElement('script')
api.src = 'https://www.youtube.com/iframe_api'
document.head.append(api)
</script></body></html>`
}

function respond(response: ServerResponse, status: number, body: string, nonce: string): void {
	response.writeHead(status, {
		'Content-Type': 'text/html; charset=utf-8',
		'Content-Security-Policy': framePolicy(nonce),
		'X-Content-Type-Options': 'nosniff',
		'Cache-Control': 'no-store'
	})
	response.end(body)
}

export async function trailerHostOrigin(): Promise<string> {
	if (origin) {
		return origin
	}

	const listener = createServer((request, response) => {
		const url = new URL(request.url ?? '/', `http://${LISTEN_HOST}`)
		const id = url.searchParams.get('v') ?? ''
		const nonce = randomBytes(16).toString('base64')

		if (url.pathname !== '/trailer' || !VIDEO_ID.test(id)) {
			respond(response, 404, '', nonce)
			return
		}

		respond(response, 200, playerPage(id, nonce), nonce)
	})

	await new Promise<void>((resolve, reject) => {
		listener.once('error', reject)
		listener.listen(0, LISTEN_HOST, resolve)
	})

	server = listener
	origin = `http://${LISTEN_HOST}:${(listener.address() as AddressInfo).port}`

	return origin
}

export function stopTrailerHost(): void {
	server?.close()
	server?.closeAllConnections()
	server = null
	origin = null
}
