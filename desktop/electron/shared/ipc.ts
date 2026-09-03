export const IPC = {
	nodeConnection: 'node:connection',

	nodeState: 'node:state',

	appVersion: 'app:version',

	oauthAuthorize: 'oauth:authorize',
	windowMinimize: 'window:minimize',

	windowToggleMaximize: 'window:toggle-maximize',
	windowClose: 'window:close',

	windowIsMaximized: 'window:is-maximized'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
