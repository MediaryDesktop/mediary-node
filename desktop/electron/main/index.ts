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

/** Height of the strip the renderer keeps clear for the window controls. */
const TITLE_BAR_HEIGHT = 40

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 640,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: '#0d0d10',
		// The native caption bar is dropped, but not the buttons in it: Windows
		// and Linux keep drawing minimise/maximise/close as an overlay in the
		// same corner, and macOS keeps its traffic lights. Re-implementing those
		// controls in the renderer would cost the OS-native hit targets, the
		// snap-layouts flyout on Windows and the hover behaviour users expect.
		//
		// The trade is that the window loses its drag handle, so the renderer has
		// to declare one — see `-webkit-app-region: drag` in the layouts.
		titleBarStyle: 'hidden',
		...(process.platform === 'darwin'
			? {}
			: {
					titleBarOverlay: {
						// Transparent, so the strip belongs to whatever the route
						// draws underneath — the header's surface on framed pages,
						// the video on the auth screens. Only the glyphs are ours.
						color: '#00000000',
						symbolColor: '#e8e8ee',
						height: TITLE_BAR_HEIGHT
					}
				}),
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
	ipcMain.handle(IPC.oauthAuthorize, (event, consentUrl: unknown) => {
		if (typeof consentUrl !== 'string') {
			throw new TypeError('oauth: the consent URL must be a string')
		}

		// Parented to the window that asked, so the consent sheet cannot be lost
		// behind the application and the renderer stays inert while it is open.
		return authorizeOAuth(consentUrl, BrowserWindow.fromWebContents(event.sender))
	})
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
