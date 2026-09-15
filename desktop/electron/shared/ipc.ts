export const IPC = {
	nodeConnection: 'node:connection',

	nodeState: 'node:state',

	appVersion: 'app:version',

	oauthPrepare: 'oauth:prepare',
	oauthAuthorize: 'oauth:authorize',
	oauthRelease: 'oauth:release',

	aniListOpenAuthorize: 'anilist:open-authorize',

	sessionRead: 'session:read',
	sessionWrite: 'session:write',
	sessionClear: 'session:clear',
	sessionCanPersist: 'session:can-persist',

	windowMinimize: 'window:minimize',

	windowToggleMaximize: 'window:toggle-maximize',
	windowClose: 'window:close',

	windowIsMaximized: 'window:is-maximized'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
