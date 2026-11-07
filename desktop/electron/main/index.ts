import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, session, shell } from 'electron'
import { join } from 'node:path'

import { IPC } from '../shared/ipc.js'

import { webAddress } from './external.js'
import { type AppOrigin, isAllowedPermission, isAppUrl } from './guards.js'
import { NodeSupervisor, type SupervisorState } from './node-supervisor.js'
import { authorizeOAuth, prepareOAuth, releaseOAuthListener } from './oauth.js'
import {
	canPersistSession,
	clearStoredSession,
	readStoredSession,
	writeStoredSession
} from './session-store.js'
import { runSplash, type SplashHandoff } from './splash.js'
import { stopTrailerHost, trailerHostOrigin } from './trailer-host.js'

app.commandLine.appendSwitch('disable-quic')

// The app's own pages, the only ones that may hold the preload's API (see guards.ts).
const appOrigin: AppOrigin = {
	devServerUrl: process.env.ELECTRON_RENDERER_URL,
	rendererDir: join(__dirname, '../renderer')
}

// Every window — the splash and any added later: nothing in it navigates away
// from the app, follows a redirect elsewhere, or embeds a webview. Moving inside
// the app is a change of hash and never reaches these.
app.on('web-contents-created', (_event, contents) => {
	const stayHome = (event: { preventDefault: () => void }, url: string) => {
		if (!isAppUrl(url, appOrigin)) {
			event.preventDefault()
			process.stderr.write(`[shell] refused to navigate a window to ${url.slice(0, 200)}\n`)
		}
	}

	contents.on('will-navigate', stayHome)
	contents.on('will-redirect', stayHome)
	contents.on('will-attach-webview', event => event.preventDefault())
})

// ipcMain.handle for calls from the app's own pages only. Should a window ever
// show anything else, that page finds the API there and every call refused.
function handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
	ipcMain.handle(channel, (event, ...args: unknown[]) => {
		if (!isAppUrl(event.senderFrame?.url ?? '', appOrigin)) {
			throw new Error(`ipc: ${channel} refused for a page that is not the app's own`)
		}

		return listener(event, ...args)
	})
}

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
let splashHandoff: SplashHandoff | null = null

// electron-builder's own `icon:` config (see electron-builder.yml) only bakes
// the icon into the packaged exe/app bundle — an unpackaged dev run still
// shows Electron's own icon in the taskbar/dock unless a window sets this too.
// The dev server serves the renderer from memory, so out/renderer/ won't have
// a fresh copy of the public assets; read straight from the source tree then.
function appIconPath(): string {
	return process.env.ELECTRON_RENDERER_URL
		? join(__dirname, '../../src/public/logo/web-app-manifest-512x512.png')
		: join(__dirname, '../renderer/logo/web-app-manifest-512x512.png')
}

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 640,
		// Stays hidden until the splash window hands off (see splash.ts) — showing
		// it early would mean fading in an empty frame before React has painted
		// anything, trading the splash's flicker for the app window's own.
		show: false,
		autoHideMenuBar: true,
		backgroundColor: '#0d0d10',
		icon: appIconPath(),

		frame: false,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),

			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,

			// The built-in player switches between a file's audio tracks through
			// HTMLMediaElement.audioTracks, which Chromium still keeps behind a flag.
			enableBlinkFeatures: 'AudioVideoTracks'
		}
	})

	window.on('maximize', () => window.webContents.send(IPC.windowIsMaximized, true))
	window.on('unmaximize', () => window.webContents.send(IPC.windowIsMaximized, false))

	// No window ever opens inside the app: a link meant for a new one goes to
	// the system browser, and only if it is a web page (see external.ts).
	window.webContents.setWindowOpenHandler(({ url }) => {
		const address = webAddress(url)

		if (address) {
			void shell.openExternal(address)
		} else {
			process.stderr.write(
				`[shell] refused to open a link that is not a web page: ${url.slice(0, 200)}\n`
			)
		}

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
	handle(IPC.nodeConnection, () => supervisor.connection)
	handle(IPC.nodeState, (): SupervisorState => supervisor.currentState)
	handle(IPC.appVersion, () => app.getVersion())
	handle(IPC.oauthPrepare, () => prepareOAuth())
	handle(IPC.oauthRelease, () => releaseOAuthListener())
	handle(IPC.oauthAuthorize, (_event, consentUrl: unknown) => {
		if (typeof consentUrl !== 'string') {
			throw new TypeError('oauth: the consent URL must be a string')
		}

		return authorizeOAuth(consentUrl)
	})

	handle(IPC.aniListOpenAuthorize, (_event, authorizeUrl: unknown) => openAniListAuthorize(authorizeUrl))

	handle(IPC.trailerHost, () => trailerHostOrigin())

	// The renderer has no filesystem access, so a library folder can only be
	// chosen through the OS dialog the main process owns.
	handle(IPC.dialogPickFolder, async (event): Promise<string | null> => {
		const parent = BrowserWindow.fromWebContents(event.sender)

		const result = parent
			? await dialog.showOpenDialog(parent, { properties: ['openDirectory'] })
			: await dialog.showOpenDialog({ properties: ['openDirectory'] })

		if (result.canceled) {
			return null
		}

		return result.filePaths[0] ?? null
	})

	handle(IPC.sessionCanPersist, () => canPersistSession())
	handle(IPC.sessionRead, () => readStoredSession())
	handle(IPC.sessionWrite, (_event, stored: unknown) => {
		if (typeof stored !== 'object' || stored === null) {
			throw new TypeError('session: expected a record to store')
		}

		const { token, account } = stored as { token?: unknown; account?: unknown }

		if (token !== null && typeof token !== 'string') {
			throw new TypeError('session: the token must be a string or null')
		}

		return writeStoredSession({ token: token ?? null, account: account ?? null })
	})
	handle(IPC.sessionClear, () => clearStoredSession())

	handle(IPC.windowMinimize, event => BrowserWindow.fromWebContents(event.sender)?.minimize())
	handle(IPC.windowToggleMaximize, event => {
		const window = BrowserWindow.fromWebContents(event.sender)

		if (window?.isMaximized()) {
			window.unmaximize()
		} else {
			window?.maximize()
		}
	})
	handle(IPC.windowClose, event => BrowserWindow.fromWebContents(event.sender)?.close())
	handle(
		IPC.windowIsMaximized,
		event => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
	)

	handle(IPC.appBooted, () => splashHandoff?.reportBooted())
	handle(IPC.splashDismiss, () => splashHandoff?.reportDismissed())
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

		// Electron grants every permission a page asks for unless told otherwise.
		session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) =>
			callback(isAllowedPermission(permission))
		)
		session.defaultSession.setPermissionCheckHandler((_contents, permission) =>
			isAllowedPermission(permission)
		)

		registerIpc()

		mainWindow = createWindow()

		splashHandoff = runSplash({
			preloadPath: join(__dirname, '../preload/index.js'),
			devServerUrl: process.env.ELECTRON_RENDERER_URL,
			rendererDir: join(__dirname, '../renderer'),
			iconPath: appIconPath(),
			mainWindow
		})

		supervisor.start().catch((error: unknown) => {
			process.stderr.write(`[shell] node failed to start: ${String(error)}\n`)
		})

		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				// No splash on a reopen — the app has already booted once this run.
				mainWindow = createWindow()
				mainWindow.once('ready-to-show', () => mainWindow?.show())
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
