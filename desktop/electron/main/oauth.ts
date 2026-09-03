import { BrowserWindow } from 'electron'

export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

const WINDOW_WIDTH = 520
const WINDOW_HEIGHT = 720

let activeWindow: BrowserWindow | null = null

function redirectTargetOf(consentUrl: URL): string {
	const target = consentUrl.searchParams.get('redirect_uri')

	if (!target) {
		throw new Error('the consent URL carries no redirect_uri to intercept')
	}

	return target
}

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

			window.destroy()
		}

		const intercept = (event: { preventDefault: () => void }, url: string) => {
			if (!url.startsWith(redirectTarget)) {
				return
			}

			event.preventDefault()

			try {
				const redirect = resultOf(new URL(url))

				settle(() => resolve(redirect))
			} catch (error) {
				settle(() => reject(error instanceof Error ? error : new Error(String(error))))
			}
		}

		window.webContents.on('will-redirect', intercept)
		window.webContents.on('will-navigate', intercept)

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
