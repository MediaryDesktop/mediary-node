export const IPC = {
	nodeConnection: 'node:connection',

	nodeState: 'node:state',
	nodeRetry: 'node:retry',

	appVersion: 'app:version',

	updateState: 'update:state',
	updateInstall: 'update:install',

	dialogPickFolder: 'dialog:pick-folder',
	dialogSaveFile: 'dialog:save-file',

	oauthPrepare: 'oauth:prepare',
	oauthAuthorize: 'oauth:authorize',
	oauthRelease: 'oauth:release',

	aniListOpenAuthorize: 'anilist:open-authorize',

	trailerHost: 'trailer:host',

	pipOpen: 'pip:open',
	pipDismiss: 'pip:dismiss',
	pipClosed: 'pip:closed',
	pipParams: 'pip:params',
	pipReport: 'pip:report',
	pipFinish: 'pip:finish',

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
