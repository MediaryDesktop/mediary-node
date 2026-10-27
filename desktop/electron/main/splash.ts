import { BrowserWindow } from 'electron'
import { join } from 'node:path'

const SPLASH_SIZE = 600

// Waits this long before fading the splash in at all — a boot that lands
// before it elapses never shows the splash, so a fast machine doesn't get a
// flash of it for no reason. (Seanime does the same.)
const SHOW_DELAY_MS = 500

// Holds the splash on screen for at least this long after it actually shows,
// even on a boot that finishes instantly — gone the moment the node answers,
// it would just be a flash of its own on a fast machine, trading one flicker
// for another. Generous on purpose: it also doubles as time to look at the
// splash itself while iterating on its styling.
const MIN_VISIBLE_MS = 3000

const FADE_MS = 220
const FADE_STEPS = 12
const FADE_STEP_MS = FADE_MS / FADE_STEPS

async function fade(window: BrowserWindow, from: number, to: number): Promise<void> {
	for (let step = 1; step <= FADE_STEPS; step++) {
		if (window.isDestroyed()) {
			return
		}

		window.setOpacity(from + ((to - from) * step) / FADE_STEPS)

		await new Promise(resolve => setTimeout(resolve, FADE_STEP_MS))
	}
}

function createSplashWindow(
	preloadPath: string,
	devServerUrl: string | undefined,
	rendererDir: string,
	iconPath: string,
	onShown: () => void
): BrowserWindow {
	const window = new BrowserWindow({
		width: SPLASH_SIZE,
		height: SPLASH_SIZE,
		resizable: false,
		frame: false,
		show: false,
		backgroundColor: '#181818',
		icon: iconPath,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		}
	})

	// A flat delay, not raced against 'ready-to-show': the static splash page
	// is trivial to paint, so by the time this fires it's already there — the
	// point is purely to hold off showing anything for a beat.
	setTimeout(() => {
		if (window.isDestroyed()) {
			return
		}

		window.setOpacity(0)
		window.show()
		void fade(window, 0, 1)
		onShown()
	}, SHOW_DELAY_MS)

	if (devServerUrl) {
		void window.loadURL(`${devServerUrl}/splash.html`)
	} else {
		void window.loadFile(join(rendererDir, 'splash.html'))
	}

	return window
}

export interface SplashHandoff {
	// Fires once the renderer says the app has booted, or once the user bails
	// out through the splash's own "continue anyway" on a failed boot.
	reportBooted(): void
	reportDismissed(): void
}

/**
 * Shows the splash window, keeps it up until the app is actually ready (or the
 * user gives up waiting on it), then crossfades it out for the main window —
 * never resizing or reusing a single window for both, which is what left the
 * splash's own logo ghosting on top of the grown app window before.
 */
export function runSplash(params: {
	preloadPath: string
	devServerUrl: string | undefined
	rendererDir: string
	iconPath: string
	mainWindow: BrowserWindow
}): SplashHandoff {
	const { preloadPath, devServerUrl, rendererDir, iconPath, mainWindow } = params

	let booted = false
	let dismissed = false
	let minTimeElapsed = false
	let handedOff = false
	let minTimeTimer: ReturnType<typeof setTimeout> | undefined

	const splashWindow = createSplashWindow(preloadPath, devServerUrl, rendererDir, iconPath, () => {
		// The minimum-visible clock only starts once the splash is actually on
		// screen — the show delay before it isn't time the user spent looking at it.
		minTimeTimer = setTimeout(() => {
			minTimeElapsed = true
			tryHandOff()
		}, MIN_VISIBLE_MS)
	})

	function tryHandOff(): void {
		if (handedOff || (!dismissed && !(booted && minTimeElapsed))) {
			return
		}

		handedOff = true
		clearTimeout(minTimeTimer)

		void (async () => {
			await fade(splashWindow, 1, 0)

			if (!splashWindow.isDestroyed()) {
				splashWindow.close()
			}

			if (mainWindow.isDestroyed()) {
				return
			}

			mainWindow.center()
			mainWindow.setOpacity(0)
			mainWindow.show()
			await fade(mainWindow, 0, 1)
		})()
	}

	return {
		reportBooted: () => {
			booted = true
			tryHandOff()
		},
		reportDismissed: () => {
			dismissed = true
			tryHandOff()
		}
	}
}
