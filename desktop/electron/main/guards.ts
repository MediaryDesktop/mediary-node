import { pathToFileURL } from 'node:url'

// What may live in the app's windows, and what those pages may ask for.
//
// The preload is attached to whatever a window shows, and through it a page can
// read the node's token and the cloud session. Only the app's own pages are
// meant to have that: a window never navigates anywhere else, an IPC call from
// anywhere else is refused, and the permissions a page may be granted are the
// two the app uses.

/** Where the app's own pages are served from: the dev server, or the bundle. */
export interface AppOrigin {
	devServerUrl?: string
	rendererDir: string
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

	if (url.protocol !== 'file:') {
		return false
	}

	// The renderer folder itself, with a trailing slash, so that a sibling
	// folder whose name merely starts the same way does not pass.
	const root = pathToFileURL(origin.rendererDir).href.replace(/\/?$/u, '/')

	return url.href.startsWith(root)
}

// The video player goes fullscreen, and the plugin dialog copies an address.
// Electron grants every other request unless told otherwise — camera,
// microphone, location, notifications — and nothing in the app needs them.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])

export function isAllowedPermission(permission: string): boolean {
	return ALLOWED_PERMISSIONS.has(permission)
}
