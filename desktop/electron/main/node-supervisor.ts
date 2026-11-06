import { app } from 'electron'
import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { urlToken } from './url-token'

export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
	/** Rides in addresses instead of the node token: see url-token.ts. */
	urlToken: string
}

export interface SupervisorOptions {
	host?: string
	port?: number

	startupTimeoutMs?: number
	onLog?: (line: string, stream: 'stdout' | 'stderr') => void
	onStateChange?: (state: SupervisorState) => void
}

export type SupervisorState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

const DEFAULT_HOST = '127.0.0.1'

const DEFAULT_PORT = 43711

const DEFAULT_STARTUP_TIMEOUT_MS = 20_000

const RESTART_DELAYS_MS = [500, 1_000, 2_000, 5_000, 10_000]

interface ExternalNode {
	baseUrl: string
	token: string
}

function externalNode(): ExternalNode | null {
	const baseUrl = process.env.MEDIARY_NODE_URL
	const token = process.env.MEDIARY_NODE_TOKEN

	if (!baseUrl || !token || app.isPackaged) {
		return null
	}

	return { baseUrl: baseUrl.replace(/\/$/u, ''), token }
}

export class NodeSupervisor {
	private child: ChildProcess | null = null
	private state: SupervisorState = 'stopped'
	private restartAttempt = 0
	private stopping = false

	private readonly host: string
	private readonly preferredPort: number

	private port: number
	private portReserved = false
	private readonly startupTimeoutMs: number
	private readonly options: SupervisorOptions

	private readonly external = externalNode()

	private readonly token: string

	constructor(options: SupervisorOptions = {}) {
		this.options = options
		this.host = options.host ?? DEFAULT_HOST
		this.preferredPort = options.port ?? DEFAULT_PORT
		this.port = this.preferredPort
		this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
		this.token = this.external?.token ?? randomBytes(32).toString('base64url')
	}

	get attached(): boolean {
		return this.external !== null
	}

	async reservePort(): Promise<number> {
		if (this.external) {
			return this.port
		}

		if (this.portReserved && (await isPortFree(this.host, this.port))) {
			return this.port
		}

		const previous = this.portReserved ? this.port : null

		if (await isPortFree(this.host, this.preferredPort)) {
			this.port = this.preferredPort
		} else {
			this.port = await askOsForPort(this.host)
		}

		if (previous !== null && previous !== this.port) {
			this.options.onLog?.(
				`port ${previous} was taken while we were away; moving to ${this.port}`,
				'stdout'
			)
		} else if (this.port !== this.preferredPort) {
			this.options.onLog?.(`port ${this.preferredPort} is taken; using ${this.port} instead`, 'stdout')
		}

		this.portReserved = true

		return this.port
	}

	get connection(): NodeConnection {
		const base = this.external?.baseUrl ?? `http://${this.host}:${this.port}`

		return {
			baseUrl: base,
			wsUrl: `${base.replace(/^http/u, 'ws')}/ws`,
			token: this.token,
			urlToken: urlToken(this.token)
		}
	}

	get currentState(): SupervisorState {
		return this.state
	}

	async start(): Promise<void> {
		if (this.child) {
			return
		}

		this.stopping = false
		this.setState('starting')

		if (this.external) {
			this.options.onLog?.(
				`attaching to the node already running at ${this.external.baseUrl}`,
				'stdout'
			)

			await this.waitUntilHealthy()

			this.restartAttempt = 0
			this.setState('ready')

			return
		}

		await this.reservePort()

		const binary = resolveBinaryPath()

		if (!binary) {
			this.setState('failed')
			throw new Error(
				'Node binary not found. Run `npm run server:build` (development) ' +
					'or check that the binary was bundled into resources/bin (packaged).'
			)
		}

		this.child = spawn(binary, [], {
			env: {
				...devServerEnv(),
				// The node's own default is in its data folder, out of the user's sight;
				// on a desktop, gigabytes of video belong where they look for downloads.
				NODE_TORRENT_DOWNLOAD_DIR: join(app.getPath('downloads'), 'Mediary'),
				...process.env,
				NODE_HTTP_HOST: this.host,
				NODE_HTTP_PORT: String(this.port),
				NODE_TOKEN: this.token,
				NODE_HTTP_ALLOWED_ORIGINS: allowedOrigins().join(','),
				NODE_LOG_PRETTY: 'false'
			},

			detached: false,
			stdio: ['ignore', 'pipe', 'pipe']
		})

		this.child.stdout?.on('data', (chunk: Buffer) => this.forwardLog(chunk, 'stdout'))
		this.child.stderr?.on('data', (chunk: Buffer) => this.forwardLog(chunk, 'stderr'))

		this.child.on('exit', (code, signal) => {
			this.child = null

			if (this.stopping) {
				this.setState('stopped')
				return
			}

			this.options.onLog?.(`node exited (code=${code} signal=${signal})`, 'stderr')
			void this.restart()
		})

		await this.waitUntilHealthy()

		this.restartAttempt = 0
		this.setState('ready')
	}

	async stop(): Promise<void> {
		this.stopping = true

		if (this.external) {
			this.setState('stopped')
			return
		}

		const child = this.child
		if (!child) {
			this.setState('stopped')
			return
		}

		child.kill('SIGTERM')

		await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), delay(5_000)])

		if (this.child) {
			this.child.kill('SIGKILL')
			this.child = null
		}

		this.setState('stopped')
	}

	private async restart(): Promise<void> {
		this.setState('restarting')

		const wait = RESTART_DELAYS_MS[Math.min(this.restartAttempt, RESTART_DELAYS_MS.length - 1)]
		this.restartAttempt += 1

		await delay(wait)

		if (this.stopping) {
			return
		}

		try {
			await this.start()
		} catch (error) {
			this.options.onLog?.(`restart failed: ${String(error)}`, 'stderr')
			this.setState('failed')
		}
	}

	private async waitUntilHealthy(): Promise<void> {
		const deadline = Date.now() + this.startupTimeoutMs

		while (Date.now() < deadline) {
			if (!this.child && !this.external) {
				throw new Error('node exited before it became healthy')
			}

			try {
				const response = await fetch(`${this.connection.baseUrl}/healthz`, {
					signal: AbortSignal.timeout(1_000)
				})

				if (response.ok) {
					return
				}
			} catch {}

			await delay(200)
		}

		throw new Error(`node did not become healthy within ${this.startupTimeoutMs}ms`)
	}

	private forwardLog(chunk: Buffer, stream: 'stdout' | 'stderr'): void {
		for (const line of chunk.toString('utf8').split('\n')) {
			if (line.trim()) {
				this.options.onLog?.(line, stream)
			}
		}
	}

	private setState(state: SupervisorState): void {
		if (this.state === state) {
			return
		}

		this.state = state
		this.options.onStateChange?.(state)
	}
}

function isPortFree(host: string, port: number): Promise<boolean> {
	return new Promise(resolve => {
		const probe = createServer()

		probe.once('error', () => resolve(false))
		probe.once('listening', () => probe.close(() => resolve(true)))
		probe.listen(port, host)
	})
}

function askOsForPort(host: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer()

		probe.once('error', reject)
		probe.listen(0, host, () => {
			const address = probe.address()

			if (address === null || typeof address === 'string') {
				probe.close(() => reject(new Error('could not determine a free port')))
				return
			}

			const { port } = address
			probe.close(() => resolve(port))
		})
	})
}

// Packaged builds ship no server/.env — keys there (TMDB, AniList…) reach the
// node only through real environment variables, same as any other secret. In
// dev, Task's `dotenv: [".env"]` feeds it when the Go binary runs under `task
// dev`, but Electron spawns the raw binary itself, so it has to read the file
// the same way.
function devServerEnv(): NodeJS.ProcessEnv {
	if (app.isPackaged) {
		return {}
	}

	const candidates = [
		join(app.getAppPath(), '..', 'server', '.env'),
		join(app.getAppPath(), '..', '..', 'server', '.env')
	]

	const path = candidates.find(existsSync)

	return path ? parseDotenv(readFileSync(path, 'utf8')) : {}
}

function parseDotenv(content: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {}

	for (const line of content.split('\n')) {
		const trimmed = line.trim()

		if (!trimmed || trimmed.startsWith('#')) {
			continue
		}

		const equals = trimmed.indexOf('=')
		if (equals === -1) {
			continue
		}

		const key = trimmed.slice(0, equals).trim()
		let value = trimmed.slice(equals + 1).trim()

		const quoted =
			(value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))

		if (quoted) {
			value = value.slice(1, -1)
		}

		env[key] = value
	}

	return env
}

function resolveBinaryPath(): string | null {
	const name = process.platform === 'win32' ? 'nodesrv.exe' : 'nodesrv'

	const candidates = app.isPackaged
		? [join(process.resourcesPath, 'bin', name)]
		: [
				join(app.getAppPath(), '..', 'server', 'bin', name),
				join(app.getAppPath(), '..', '..', 'server', 'bin', name)
			]

	return candidates.find(existsSync) ?? null
}

function allowedOrigins(): string[] {
	const origins = ['app://-', 'file://']

	const devServer = process.env.ELECTRON_RENDERER_URL
	if (devServer) {
		origins.push(new URL(devServer).origin)
	}

	return origins
}
