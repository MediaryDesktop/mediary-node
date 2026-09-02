/** IPC channel names shared by main and preload, so a rename is a compile
 * error rather than a handler that silently never fires. */
export const IPC = {
	/** Returns { baseUrl, wsUrl, token } for reaching the local node. */
	nodeConnection: 'node:connection',
	/** Invoke for the current supervisor state; also pushed on every change. */
	nodeState: 'node:state',
	/** Returns the packaged application version. */
	appVersion: 'app:version',
	/** Opens a provider's consent page and resolves with the intercepted redirect. */
	oauthAuthorize: 'oauth:authorize',
	windowMinimize: 'window:minimize',
	/** Maximizes if restored, restores if maximized — the caption button toggles. */
	windowToggleMaximize: 'window:toggle-maximize',
	windowClose: 'window:close',
	/** Invoke for the window's maximized state right now; also pushed on every change. */
	windowIsMaximized: 'window:is-maximized'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
