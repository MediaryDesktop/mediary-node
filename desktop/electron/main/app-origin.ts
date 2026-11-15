export const APP_SCHEME = 'app'
export const APP_HOST = '-'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

// Node's URL gives a custom scheme the origin 'null', so it is compared by parts.
export function isAppOrigin(url: URL): boolean {
	return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST
}
