import { app } from 'electron'
import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * Owns the lifetime of the Go node process. The renderer talks to it over
 * HTTP on loopback, not IPC — costs a socket, buys a node that runs headless
 * in Docker and a torrent-engine crash that doesn't take the window with it.
 */

/** How the renderer reaches the node. */
export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
}

export interface SupervisorOptions {
	host?: string
	port?: number
	/** Time to wait for the node to answer /healthz before giving up. */
	startupTimeoutMs?: number
	onLog?: (line: string, stream: 'stdout' | 'stderr') => void
	onStateChange?: (state: SupervisorState) => void
}

export type SupervisorState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

const DEFAULT_HOST = '127.0.0.1'

/** Preferred port, not guaranteed — see reservePort. Not 43211 (Seanime's
 * default), or colliding with an already-running Seanime restarts forever. */
const DEFAULT_PORT = 43711

const DEFAULT_STARTUP_TIMEOUT_MS = 20_000

/** Backoff between restart attempts. The last value repeats indefinitely. */
const RESTART_DELAYS_MS = [500, 1_000, 2_000, 5_000, 10_000]

export class NodeSupervisor {
	private child: ChildProcess | null = null
	private state: SupervisorState = 'stopped'
	private restartAttempt = 0
	private stopping = false

	private readonly host: string
	private readonly preferredPort: number
	/** Resolved by reservePort before the node is ever spawned. */
	private port: number
	private portReserved = false
	private readonly startupTimeoutMs: number
	private readonly options: SupervisorOptions

	/** Generated once per launch and passed to the child via env — a token
	 * scoped to the app's lifetime can't leak from a file. */
	private readonly token = randomBytes(32).toString('base64url')

	constructor(options: SupervisorOptions = {}) {
		this.options = options
		this.host = options.host ?? DEFAULT_HOST
		this.preferredPort = options.port ?? DEFAULT_PORT
		this.port = this.preferredPort
		this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
	}

	/**
	 * Settles which port the node will listen on before anything asks — a fixed
	 * default eventually collides with something, and that failure never
	 * converges on its own. Called before the window opens.
	 */
	async reservePort(): Promise<number> {
		if (this.portReserved) {
			return this.port
		}

		if (await isPortFree(this.host, this.preferredPort)) {
			this.port = this.preferredPort
		} else {
			this.port = await askOsForPort(this.host)
			this.options.onLog?.(`port ${this.preferredPort} is taken; using ${this.port} instead`, 'stdout')
		}

		this.portReserved = true

		return this.port
	}

	get connection(): NodeConnection {
		return {
			baseUrl: `http://${this.host}:${this.port}`,
			wsUrl: `ws://${this.host}:${this.port}/ws`,
			token: this.token
		}
	}

	get currentState(): SupervisorState {
		return this.state
	}

	/** Starts the node and resolves once it answers /healthz. */
	async start(): Promise<void> {
		if (this.child) {
			return
		}

		this.stopping = false
		this.setState('starting')

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
				...process.env,
				NODE_HTTP_HOST: this.host,
				NODE_HTTP_PORT: String(this.port),
				NODE_TOKEN: this.token,
				NODE_HTTP_ALLOWED_ORIGINS: allowedOrigins().join(','),
				NODE_LOG_PRETTY: 'false'
			},
			// Detached would survive the shell; the node must not outlive its window.
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

	/** Stops the node and suppresses the automatic restart. */
	async stop(): Promise<void> {
		this.stopping = true

		const child = this.child
		if (!child) {
			this.setState('stopped')
			return
		}

		child.kill('SIGTERM')

		// Give it a moment to drain in-flight requests before insisting.
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

	/** Polls /healthz rather than a stdout ready line — a request proves the
	 * socket actually accepts connections, which is what the renderer needs. */
	private async waitUntilHealthy(): Promise<void> {
		const deadline = Date.now() + this.startupTimeoutMs

		while (Date.now() < deadline) {
			if (!this.child) {
				throw new Error('node exited before it became healthy')
			}

			try {
				const response = await fetch(`${this.connection.baseUrl}/healthz`, {
					signal: AbortSignal.timeout(1_000)
				})

				if (response.ok) {
					return
				}
			} catch {
				// Not up yet. Expected for the first few hundred milliseconds.
			}

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

/** Whether a port can be bound right now on the given host. */
function isPortFree(host: string, port: number): Promise<boolean> {
	return new Promise(resolve => {
		const probe = createServer()

		probe.once('error', () => resolve(false))
		probe.once('listening', () => probe.close(() => resolve(true)))
		probe.listen(port, host)
	})
}

/**
 * Asks the OS for any free port. There is a race — the port is released
 * before the node claims it — but it's microseconds on loopback, cheaper
 * than handing the listening socket to a Go child process.
 */
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

/** Where the node binary lives — differs between a checkout and an installed app. */
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

/**
 * Origins the node accepts requests from — loose here is worse than on a
 * public API, since any page could drive downloads or read the library.
 */
function allowedOrigins(): string[] {
	const origins = ['app://-', 'file://']

	const devServer = process.env.ELECTRON_RENDERER_URL
	if (devServer) {
		origins.push(new URL(devServer).origin)
	}

	return origins
}
