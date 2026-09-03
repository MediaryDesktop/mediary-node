import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'

import { IPC } from '../shared/ipc.js'

import { NodeSupervisor, type SupervisorState } from './node-supervisor.js'
import { authorizeOAuth } from './oauth.js'

const supervisor = new NodeSupervisor({
	onLog: (line, stream) => {
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

		frame: false,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),

			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		}
	})

	window.once('ready-to-show', () => window.show())

	window.on('maximize', () => window.webContents.send(IPC.windowIsMaximized, true))
	window.on('unmaximize', () => window.webContents.send(IPC.windowIsMaximized, false))

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
	ipcMain.handle(IPC.nodeConnection, () => supervisor.connection)
	ipcMain.handle(IPC.nodeState, (): SupervisorState => supervisor.currentState)
	ipcMain.handle(IPC.appVersion, () => app.getVersion())
	ipcMain.handle(IPC.oauthAuthorize, (event, consentUrl: unknown) => {
		if (typeof consentUrl !== 'string') {
			throw new TypeError('oauth: the consent URL must be a string')
		}

		return authorizeOAuth(consentUrl, BrowserWindow.fromWebContents(event.sender))
	})

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
		await supervisor.reservePort()

		registerIpc()

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
