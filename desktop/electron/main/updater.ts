import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'

import type { UpdateState } from '../shared/update.js'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const RELEASES_URL = 'https://github.com/MediaryDesktop/mediary-node/releases'

interface UpdaterOptions {
	onStateChange: (state: UpdateState) => void
	// Runs before the installer takes over, so the node is not holding its files.
	beforeInstall: () => Promise<void>
}

let state: UpdateState = { kind: 'none' }
let options: UpdaterOptions | null = null

// Squirrel.Mac installs only signed apps; an unsigned build learns about a
// release and leaves the download to the user.
const installsItself = process.platform !== 'darwin'

export function currentUpdateState(): UpdateState {
	return state
}

export function startUpdater(updaterOptions: UpdaterOptions): void {
	if (!app.isPackaged || process.env.MEDIARY_DISABLE_UPDATES === '1') {
		return
	}

	options = updaterOptions

	autoUpdater.logger = {
		info: (message: unknown) => process.stdout.write(`[updater] ${String(message)}\n`),
		warn: (message: unknown) => process.stderr.write(`[updater] ${String(message)}\n`),
		error: (message: unknown) => process.stderr.write(`[updater] ${String(message)}\n`),
		debug: () => {}
	}
	autoUpdater.autoDownload = installsItself
	autoUpdater.autoInstallOnAppQuit = installsItself

	autoUpdater.on('update-available', (info: UpdateInfo) => {
		setState(
			installsItself
				? { kind: 'downloading', version: info.version }
				: { kind: 'manual', version: info.version, url: `${RELEASES_URL}/tag/v${info.version}` }
		)
	})
	autoUpdater.on('update-downloaded', (info: UpdateInfo) =>
		setState({ kind: 'ready', version: info.version })
	)
	// Offline, or GitHub unreachable: the next check tries again, the user is not told.
	autoUpdater.on('error', error => process.stderr.write(`[updater] ${error.message}\n`))

	const check = () => void autoUpdater.checkForUpdates().catch(() => {})

	check()
	setInterval(check, CHECK_EVERY_MS).unref()
}

export async function installUpdate(): Promise<void> {
	if (state.kind !== 'ready' || !options) {
		return
	}

	await options.beforeInstall()
	autoUpdater.quitAndInstall()
}

function setState(next: UpdateState): void {
	state = next
	options?.onStateChange(next)
}
