import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'

import { IPC } from '../shared/ipc.js'

import { NodeSupervisor, type SupervisorState } from './node-supervisor.js'

const supervisor = new NodeSupervisor({
	onLog: (line, stream) => {
		// The node already emits structured JSON; pass it through unparsed.
		if (stream === 'stderr') {
			process.stderr.write(`[node] ${line}\n`)
		} else {
			process.stdout.write(`[node] ${line}\n`)
		}
	},
	onStateChange: state => broadcast(IPC.nodeState, state)
})

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 640,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: '#0d0d10',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			// Renderer is untrusted-by-default; everything it needs goes through preload/index.ts.
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		}
	})

	// Show only once painted, to avoid the white flash on launch.
	window.once('ready-to-show', () => window.show())

	// External links (AniList, TMDB, ...) open in the real browser, not a
	// chromeless window with no way back.
	window.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url)
		return { action: 'deny' }
	})

	const devServer = process.env.ELECTRON_RENDERER_URL

	if (devServer) {
		void window.loadURL(devServer)
	} else {
		void window.loadFile(join(__dirname, '../renderer/index.html'))
	}

	return window
}

function broadcast(channel: string, payload: unknown): void {
	for (const window of BrowserWindow.getAllWindows()) {
		window.webContents.send(channel, payload)
	}
}

function registerIpc(): void {
	// This is the entire main→renderer API — nothing else is reachable.
	ipcMain.handle(IPC.nodeConnection, () => supervisor.connection)
	ipcMain.handle(IPC.nodeState, (): SupervisorState => supervisor.currentState)
	ipcMain.handle(IPC.appVersion, () => app.getVersion())
}

// A second instance would fight the first over the node's port and SQLite file.
if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	app.on('second-instance', () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore()
			}
			mainWindow.focus()
		}
	})

	void app.whenReady().then(async () => {
		// Settle the port before the renderer can ask for it on mount.
		await supervisor.reservePort()

		registerIpc()

		// The window opens first; the renderer shows its own progress via
		// nodeState instead of blocking on node startup.
		mainWindow = createWindow()

		supervisor.start().catch((error: unknown) => {
			process.stderr.write(`[shell] node failed to start: ${String(error)}\n`)
		})

		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				mainWindow = createWindow()
			}
		})
	})

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	// Quit is deferred until the async node stop finishes, or SQLite is left
	// with a hot journal.
	let shuttingDown = false

	app.on('before-quit', event => {
		if (shuttingDown) {
			return
		}

		event.preventDefault()
		shuttingDown = true

		void supervisor.stop().finally(() => app.quit())
	})
}
