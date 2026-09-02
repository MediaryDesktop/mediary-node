import { BrowserWindow } from 'electron'

/**
 * The provider half of OAuth sign-in: a consent page, and the redirect that
 * ends it.
 *
 * The cloud never hosts a callback page — it hands out a consent URL whose
 * `redirect_uri` points at an address only this application answers for, and
 * the redirect is caught here before Chromium tries to fetch it. That is the
 * whole reason this lives in main: a sandboxed renderer cannot watch another
 * window's navigation, and shipping the user out to the system browser would
 * hand the code to whatever process happens to own that URL.
 *
 * The redirect address is expected to be an http(s) one — a loopback URL is
 * what a provider's "desktop app" client type hands out, and it is the form
 * Chromium reports through the two navigation events below.
 *
 * The window is deliberately plain — no preload, its own in-memory session —
 * so the page a provider serves has no bridge to reach and leaves no cookies
 * behind. `partition` without the `persist:` prefix is what makes it in-memory.
 */

export interface OAuthRedirect {
	code: string
	state: string
}

/**
 * Closing the window is an answer, not an error: the user changed their mind,
 * and a renderer that had to read that out of an exception message would be
 * guessing. Every other way this ends rejects.
 */
export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

const WINDOW_WIDTH = 520
const WINDOW_HEIGHT = 720

/**
 * One at a time. A second attempt while a window is open is a user who gave up
 * on the first, so the stale window goes rather than fighting for focus.
 */
let activeWindow: BrowserWindow | null = null

/** Where the provider will send the browser once the user decides. */
function redirectTargetOf(consentUrl: URL): string {
	const target = consentUrl.searchParams.get('redirect_uri')

	if (!target) {
		throw new Error('the consent URL carries no redirect_uri to intercept')
	}

	return target
}

/** The redirect either carries the pair we asked for, or says why it does not. */
function resultOf(url: URL): OAuthRedirect {
	const failure = url.searchParams.get('error')

	if (failure) {
		throw new Error(`the provider refused the sign-in: ${failure}`)
	}

	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')

	if (!code || !state) {
		throw new Error('the redirect carried no authorization code')
	}

	return { code, state }
}

export async function authorizeOAuth(
	consentUrl: string,
	parent: BrowserWindow | null
): Promise<OAuthAuthorization> {
	const consent = new URL(consentUrl)

	// The renderer is untrusted by default, and this argument crosses that line:
	// an http:// consent page would put the authorization code on the wire in
	// clear text.
	if (consent.protocol !== 'https:') {
		throw new Error('the consent URL must be https')
	}

	const redirectTarget = redirectTargetOf(consent)

	activeWindow?.destroy()

	const window = new BrowserWindow({
		width: WINDOW_WIDTH,
		height: WINDOW_HEIGHT,
		parent: parent ?? undefined,
		modal: parent !== null,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: '#0d0d10',
		webPreferences: {
			partition: 'oauth',
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		}
	})

	activeWindow = window

	return new Promise<OAuthAuthorization>((resolve, reject) => {
		let settled = false

		const settle = (outcome: () => void) => {
			if (settled) {
				return
			}

			settled = true
			outcome()
			// Destroying inside the navigation handler that is still running is
			// what Electron's own samples do; the close arrives on the next tick.
			window.destroy()
		}

		const intercept = (event: { preventDefault: () => void }, url: string) => {
			if (!url.startsWith(redirectTarget)) {
				return
			}

			// The address answers to nobody: letting the navigation proceed would
			// show the user a connection error instead of a closing window.
			event.preventDefault()

			try {
				const redirect = resultOf(new URL(url))

				settle(() => resolve(redirect))
			} catch (error) {
				settle(() => reject(error instanceof Error ? error : new Error(String(error))))
			}
		}

		// Both, because a provider reaches the redirect either by answering with
		// a 302 (`will-redirect`) or by having its own page navigate there.
		window.webContents.on('will-redirect', intercept)
		window.webContents.on('will-navigate', intercept)

		// Anything the consent page tries to open — "privacy policy", "help" —
		// belongs in the real browser, not in a window the user reads as ours.
		window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

		window.once('ready-to-show', () => window.show())

		window.on('closed', () => {
			if (activeWindow === window) {
				activeWindow = null
			}

			if (!settled) {
				settled = true
				resolve({ cancelled: true })
			}
		})

		window.loadURL(consent.toString()).catch((error: unknown) => {
			settle(() => reject(error instanceof Error ? error : new Error(String(error))))
		})
	})
}
