export const IPC = {
	nodeConnection: 'node:connection',

	nodeState: 'node:state',
	nodeRetry: 'node:retry',

	appVersion: 'app:version',

	dialogPickFolder: 'dialog:pick-folder',

	oauthPrepare: 'oauth:prepare',
	oauthAuthorize: 'oauth:authorize',
	oauthRelease: 'oauth:release',

	aniListOpenAuthorize: 'anilist:open-authorize',

	trailerHost: 'trailer:host',

	sessionRead: 'session:read',
	sessionWrite: 'session:write',
	sessionClear: 'session:clear',
	sessionCanPersist: 'session:can-persist',

	windowMinimize: 'window:minimize',

	windowToggleMaximize: 'window:toggle-maximize',
	windowClose: 'window:close',

	windowIsMaximized: 'window:is-maximized',

	appBooted: 'app:booted',
	splashDismiss: 'splash:dismiss'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
