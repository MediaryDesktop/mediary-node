import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'

import { IPC } from '../shared/ipc.js'

import { NodeSupervisor, type SupervisorState } from './node-supervisor.js'
import { authorizeOAuth } from './oauth.js'

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
		// No native chrome at all, on any platform: the renderer draws its own
		// caption buttons (`shared/ui/window-controls`) and its own drag strip
		// (`-webkit-app-region: drag` in the layouts) instead of the OS's. The
		// trade against `titleBarOverlay` is real — Windows' Snap Layouts flyout
		// and native hover feel are gone — but so is the ceiling on styling them,
		// which is what this bought.
		frame: false,
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

	window.on('maximize', () => window.webContents.send(IPC.windowIsMaximized, true))
	window.on('unmaximize', () => window.webContents.send(IPC.windowIsMaximized, false))

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
	ipcMain.handle(IPC.oauthAuthorize, (event, consentUrl: unknown) => {
		if (typeof consentUrl !== 'string') {
			throw new TypeError('oauth: the consent URL must be a string')
		}

		// Parented to the window that asked, so the consent sheet cannot be lost
		// behind the application and the renderer stays inert while it is open.
		return authorizeOAuth(consentUrl, BrowserWindow.fromWebContents(event.sender))
	})

	// The caption buttons act on the window that hosts the page calling them,
	// not on `mainWindow` — the two agree today (one window, single-instance
	// locked) but a handler that reached for the module-level variable would
	// silently stop working the day that changes.
	ipcMain.handle(IPC.windowMinimize, event => BrowserWindow.fromWebContents(event.sender)?.minimize())
	ipcMain.handle(IPC.windowToggleMaximize, event => {
		const window = BrowserWindow.fromWebContents(event.sender)

		if (window?.isMaximized()) {
			window.unmaximize()
		} else {
			window?.maximize()
		}
	})
	ipcMain.handle(IPC.windowClose, event => BrowserWindow.fromWebContents(event.sender)?.close())
	ipcMain.handle(
		IPC.windowIsMaximized,
		event => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
	)
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
