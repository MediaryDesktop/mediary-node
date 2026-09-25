import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'

import { IPC } from '../shared/ipc.js'

import { NodeSupervisor, type SupervisorState } from './node-supervisor.js'
import { authorizeOAuth, prepareOAuth, releaseOAuthListener } from './oauth.js'
import {
	canPersistSession,
	clearStoredSession,
	readStoredSession,
	writeStoredSession
} from './session-store.js'
import { stopTrailerHost, trailerHostOrigin } from './trailer-host.js'

app.commandLine.appendSwitch('disable-quic')

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

const ANILIST_HOST = 'anilist.co'

function openAniListAuthorize(authorizeUrl: unknown): Promise<void> {
	if (typeof authorizeUrl !== 'string') {
		throw new TypeError('anilist: the authorize URL must be a string')
	}

	const url = new URL(authorizeUrl)

	if (url.protocol !== 'https:' || url.hostname !== ANILIST_HOST) {
		throw new Error('anilist: refusing to open a non-AniList address')
	}

	return shell.openExternal(url.toString())
}

function registerIpc(): void {
	ipcMain.handle(IPC.nodeConnection, () => supervisor.connection)
	ipcMain.handle(IPC.nodeState, (): SupervisorState => supervisor.currentState)
	ipcMain.handle(IPC.appVersion, () => app.getVersion())
	ipcMain.handle(IPC.oauthPrepare, () => prepareOAuth())
	ipcMain.handle(IPC.oauthRelease, () => releaseOAuthListener())
	ipcMain.handle(IPC.oauthAuthorize, (_event, consentUrl: unknown) => {
		if (typeof consentUrl !== 'string') {
			throw new TypeError('oauth: the consent URL must be a string')
		}

		return authorizeOAuth(consentUrl)
	})

	ipcMain.handle(IPC.aniListOpenAuthorize, (_event, authorizeUrl: unknown) =>
		openAniListAuthorize(authorizeUrl)
	)

	ipcMain.handle(IPC.trailerHost, () => trailerHostOrigin())

	// The renderer has no filesystem access, so a library folder can only be
	// chosen through the OS dialog the main process owns.
	ipcMain.handle(IPC.dialogPickFolder, async (event): Promise<string | null> => {
		const parent = BrowserWindow.fromWebContents(event.sender)

		const result = parent
			? await dialog.showOpenDialog(parent, { properties: ['openDirectory'] })
			: await dialog.showOpenDialog({ properties: ['openDirectory'] })

		if (result.canceled) {
			return null
		}

		return result.filePaths[0] ?? null
	})

	ipcMain.handle(IPC.sessionCanPersist, () => canPersistSession())
	ipcMain.handle(IPC.sessionRead, () => readStoredSession())
	ipcMain.handle(IPC.sessionWrite, (_event, session: unknown) => {
		if (typeof session !== 'object' || session === null) {
			throw new TypeError('session: expected a record to store')
		}

		const { token, account } = session as { token?: unknown; account?: unknown }

		if (token !== null && typeof token !== 'string') {
			throw new TypeError('session: the token must be a string or null')
		}

		return writeStoredSession({ token: token ?? null, account: account ?? null })
	})
	ipcMain.handle(IPC.sessionClear, () => clearStoredSession())

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

	app.on('before-quit', releaseOAuthListener)
	app.on('before-quit', stopTrailerHost)

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
