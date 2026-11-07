// Schemes a link from the renderer may be handed to the operating system with.
// Everything a window opens goes to shell.openExternal, and some of those
// addresses come from outside the app — a torrent indexer's release page, a
// plugin's, a title's external links. The OS acts on whatever scheme it is
// given: file:// opens or runs a file, and Windows' search-ms:, ms-msdt: and
// friends have been ways to run code from a single click. A web page is all a
// link here is ever meant to be.
const WEB_SCHEMES = new Set(['https:', 'http:'])

/** The address to open, normalised, or null for one the OS must not get. */
export function webAddress(raw: string): string | null {
	let url: URL

	try {
		url = new URL(raw)
	} catch {
		return null
	}

	if (!WEB_SCHEMES.has(url.protocol) || url.hostname === '' || url.username !== '' || url.password !== '') {
		return null
	}

	return url.toString()
}
