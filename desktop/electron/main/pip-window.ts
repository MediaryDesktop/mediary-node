import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, screen } from 'electron'

import { IPC } from '../shared/ipc.js'
import type { PipIntent, PipOpenOptions, PipResult, PipSnapshot } from '../shared/pip.js'

import { parseIntent, parseOpenOptions, parseSnapshot } from './pip-options.js'

const DEFAULT_WIDTH = 480
const MIN_WIDTH = 256
const MARGIN = 24

type Handle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => void

export interface PipHost {
	preloadPath: string
	/** The address of the page the window shows. */
	pageUrl: () => string
	iconPath: string
	mainWindow: () => BrowserWindow | null
}

let pip: BrowserWindow | null = null
let options: PipOpenOptions | null = null
let last: PipSnapshot | null = null

// The page hears about the window going once: a close we asked for says it
// already, and the window's own `closed` then has nothing to add.
let concluded = false

// Where the user left it, kept for the next time within this run.
let remembered: Electron.Rectangle | null = null

function conclude(host: PipHost, intent: PipIntent, snapshot: PipSnapshot | null) {
	if (concluded) {
		return
	}

	concluded = true

	const result: PipResult = { intent, ...(snapshot ?? last ?? options ?? { position: 0, playing: false }) }

	host.mainWindow()?.webContents.send(IPC.pipClosed, result)
}

function placement(host: PipHost, width: number, height: number): { x: number; y: number } {
	if (remembered) {
		return { x: remembered.x, y: remembered.y }
	}

	const main = host.mainWindow()
	const display = main ? screen.getDisplayMatching(main.getBounds()) : screen.getPrimaryDisplay()
	const area = display.workArea

	return { x: area.x + area.width - width - MARGIN, y: area.y + area.height - height - MARGIN }
}

function openWindow(host: PipHost, opened: PipOpenOptions): void {
	dismissPip()

	options = opened
	last = { position: opened.position, playing: opened.playing }
	concluded = false

	const width = remembered?.width ?? DEFAULT_WIDTH
	const height = Math.round(width / opened.aspect)

	const window = new BrowserWindow({
		width,
		height,
		...placement(host, width, height),
		minWidth: MIN_WIDTH,
		minHeight: Math.round(MIN_WIDTH / opened.aspect),
		show: false,
		frame: false,
		resizable: true,
		maximizable: false,
		fullscreenable: false,
		autoHideMenuBar: true,
		backgroundColor: '#000000',
		icon: host.iconPath,
		title: 'Mediary',
		webPreferences: {
			preload: host.preloadPath,

			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,

			// The player switches audio tracks through HTMLMediaElement.audioTracks.
			enableBlinkFeatures: 'AudioVideoTracks'
		}
	})

	pip = window

	// Over every other window, including full-screen ones.
	window.setAlwaysOnTop(true, 'screen-saver')
	window.setAspectRatio(opened.aspect)

	if (process.platform === 'darwin') {
		window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
	}

	// Nothing opens from here and nothing navigates away from the player.
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
	window.webContents.on('will-navigate', event => event.preventDefault())

	const remember = () => {
		if (!window.isDestroyed()) {
			remembered = window.getBounds()
		}
	}

	window.on('resized', remember)
	window.on('moved', remember)
	window.once('ready-to-show', () => window.show())

	window.on('closed', () => {
		conclude(host, 'mini', null)

		if (pip === window) {
			pip = null
			options = null
			last = null
		}
	})

	void window.loadURL(host.pageUrl())
}

/** Closes the window without telling the page: it is the page that asked. */
export function dismissPip(): void {
	if (!pip || pip.isDestroyed()) {
		return
	}

	concluded = true
	pip.close()
}

export function registerPipIpc(handle: Handle, host: PipHost): void {
	const fromMain = (event: IpcMainInvokeEvent | IpcMainEvent) =>
		host.mainWindow()?.webContents === event.sender

	const fromPip = (event: IpcMainInvokeEvent | IpcMainEvent) =>
		pip !== null && !pip.isDestroyed() && pip.webContents === event.sender

	handle(IPC.pipOpen, (event, value) => {
		const opened = parseOpenOptions(value)

		if (!fromMain(event) || !opened) {
			return false
		}

		openWindow(host, opened)

		return true
	})

	handle(IPC.pipDismiss, event => {
		if (fromMain(event)) {
			dismissPip()
		}
	})

	handle(IPC.pipParams, event => (fromPip(event) ? options : null))

	handle(IPC.pipFinish, (event, intentValue, snapshotValue) => {
		const intent = parseIntent(intentValue)

		if (!fromPip(event) || !intent) {
			return
		}

		conclude(host, intent, parseSnapshot(snapshotValue))
		pip?.close()
	})

	// Sent a few times a second while it plays; kept for the day the window is
	// closed some way that cannot say where it was.
	ipcMain.on(IPC.pipReport, (event, value: unknown) => {
		const snapshot = parseSnapshot(value)

		if (fromPip(event) && snapshot) {
			last = snapshot
		}
	})
}
