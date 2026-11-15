import { net, protocol } from 'electron'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { APP_ORIGIN, APP_SCHEME, isAppOrigin } from './app-origin.js'

// The packaged renderer is served from app://-/ rather than file://: a page on
// file:// may read any other file:// URL, and its module scripts, the pdf.js
// worker and the subtitle wasm only load there with the extra privileges the
// grantFileProtocolExtraPrivileges fuse keeps on. Here the page is an origin
// of its own, and reaches nothing but the bundle.
export function appPageUrl(page: string): string {
	return `${APP_ORIGIN}/${page}`
}

// Before the app is ready: a scheme gets its privileges only then.
export function registerAppScheme(): void {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				corsEnabled: true,
				codeCache: true
			}
		}
	])
}

export function serveAppScheme(rendererDir: string): void {
	protocol.handle(APP_SCHEME, request => {
		const file = appFilePath(request.url, rendererDir)

		if (!file) {
			return new Response(null, { status: 404 })
		}

		return net.fetch(pathToFileURL(file).href).catch(() => new Response(null, { status: 404 }))
	})
}

// The file inside the bundle an app:// address names, or null for anything
// else: another host, or a path that climbs out of the bundle.
export function appFilePath(raw: string, rendererDir: string): string | null {
	let url: URL

	try {
		url = new URL(raw)
	} catch {
		return null
	}

	if (!isAppOrigin(url)) {
		return null
	}

	let path: string

	try {
		path = decodeURIComponent(url.pathname)
	} catch {
		return null
	}

	const root = resolve(rendererDir)
	const file = resolve(root, `.${path === '/' ? '/index.html' : path}`)
	const inside = relative(root, file)

	if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
		return null
	}

	return file
}
