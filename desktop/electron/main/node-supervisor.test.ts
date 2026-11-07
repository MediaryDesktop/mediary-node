import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { SupervisorState } from './node-supervisor'

// The supervisor finds the node binary next to the app path in development. The
// test moves that path to make the binary disappear and come back.
const appPath = vi.hoisted(() => ({ current: '' }))

vi.mock('electron', () => ({
	app: {
		isPackaged: false,
		getAppPath: () => appPath.current,
		getPath: () => tmpdir()
	}
}))

const { NodeSupervisor } = await import('./node-supervisor')

const DESKTOP = join(__dirname, '..', '..')
const BINARY = join(DESKTOP, '..', 'server', 'bin', process.platform === 'win32' ? 'nodesrv.exe' : 'nodesrv')

describe.skipIf(!existsSync(BINARY))('retrying a node that was given up on', () => {
	let data = ''
	const saved = { ...process.env }

	beforeAll(() => {
		data = mkdtempSync(join(tmpdir(), 'mediary-supervisor-'))
		process.env.NODE_ENV = 'development'
		process.env.NODE_DATA_DIR = join(data, 'node')
		process.env.NODE_TORRENT_DOWNLOAD_DIR = join(data, 'downloads')
		delete process.env.MEDIARY_NODE_URL
	})

	afterAll(() => {
		process.env = saved
		rmSync(data, { recursive: true, force: true })
	})

	it('starts the node again, from scratch, once it can be found', { timeout: 60_000 }, async () => {
		const states: SupervisorState[] = []
		const logs: string[] = []
		const supervisor = new NodeSupervisor({
			port: 47_311,
			onStateChange: state => states.push(state),
			onLog: line => logs.push(line)
		})

		appPath.current = join(data, 'nowhere', 'app')
		await expect(supervisor.start()).rejects.toThrow(/binary not found/i)
		expect(supervisor.currentState).toBe('failed')

		appPath.current = join(DESKTOP, 'app')
		await supervisor.retry()

		try {
			expect(supervisor.currentState, logs.join(' | ')).toBe('ready')
			expect(states).toEqual(['starting', 'failed', 'starting', 'ready'])

			const health = await fetch(`${supervisor.connection.baseUrl}/healthz`)
			expect(health.ok).toBe(true)
		} finally {
			await supervisor.stop()
		}

		expect(supervisor.currentState).toBe('stopped')
	})

	it('leaves a node that was not given up on alone', async () => {
		const supervisor = new NodeSupervisor()

		await supervisor.retry()

		expect(supervisor.currentState).toBe('stopped')
	})
})
