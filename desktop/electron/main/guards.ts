import { isAppOrigin } from './app-origin.js'

// What may live in the app's windows, and what those pages may ask for.
//
// The preload is attached to whatever a window shows, and through it a page can
// read the node's token and the cloud session. Only the app's own pages are
// meant to have that: a window never navigates anywhere else, an IPC call from
// anywhere else is refused, and the permissions a page may be granted are the
// two the app uses.

/** Where the app's own pages are served from: the dev server, or app://-. */
export interface AppOrigin {
	devServerUrl?: string
}

export function isAppUrl(raw: string, origin: AppOrigin): boolean {
	let url: URL

	try {
		url = new URL(raw)
	} catch {
		return false
	}

	if (origin.devServerUrl) {
		return url.origin === new URL(origin.devServerUrl).origin
	}

	return isAppOrigin(url)
}

// The video player goes fullscreen, and the plugin dialog copies an address.
// Electron grants every other request unless told otherwise — camera,
// microphone, location, notifications — and nothing in the app needs them.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])

export function isAllowedPermission(permission: string): boolean {
	return ALLOWED_PERMISSIONS.has(permission)
}
