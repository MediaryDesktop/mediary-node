import type { MediaryBridge } from './index.js'

/**
 * Makes `window.mediary` typed in the renderer.
 *
 * The renderer never imports the preload module itself — it runs in a different
 * context and importing it would pull Electron into the browser bundle. It
 * imports only this declaration.
 */
declare global {
	interface Window {
		mediary: MediaryBridge
	}
}

export {}
