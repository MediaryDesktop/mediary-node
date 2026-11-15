import type {
	TorrentCheckParams,
	TorrentClientKind,
	TorrentSettings,
	TorrentSettingsUpdate
} from '@entities/torrent'

export const NONE = 'none'

export type ClientChoice = Exclude<TorrentClientKind, ''> | typeof NONE

export interface ClientFields {
	choice: ClientChoice
	url: string
	username: string
	password: string
	rootId: number
	mapClient: string
	mapNode: string
}

export interface ClientProblems {
	mappingHalf: boolean
	missingUrl: boolean
	missingDebrid: boolean
}

export function fieldsOf(settings: TorrentSettings): ClientFields {
	return {
		choice: settings.client || NONE,
		url: settings.url,
		username: settings.username,
		password: '',
		rootId: settings.root_id,
		mapClient: settings.path_map.client,
		mapNode: settings.path_map.node
	}
}

export function clientOf(choice: ClientChoice): TorrentClientKind {
	return choice === NONE ? '' : choice
}

// Only qBittorrent has an address and a path mapping to get wrong; debrid needs
// a service set up first.
export function problemsOf(fields: ClientFields, debridReady: boolean): ClientProblems {
	const qbittorrent = fields.choice === 'qbittorrent'

	return {
		mappingHalf: qbittorrent && (fields.mapClient.trim() === '') !== (fields.mapNode.trim() === ''),
		missingUrl: qbittorrent && fields.url.trim() === '',
		missingDebrid: fields.choice === 'debrid' && !debridReady
	}
}

export function hasProblems(problems: ClientProblems): boolean {
	return problems.mappingHalf || problems.missingUrl || problems.missingDebrid
}

// An empty password field keeps the stored one rather than clearing it.
function passwordOf(fields: ClientFields, hasPassword: boolean): string | undefined {
	return hasPassword && fields.password === '' ? undefined : fields.password
}

export function settingsUpdate(fields: ClientFields, hasPassword: boolean): TorrentSettingsUpdate {
	return {
		client: clientOf(fields.choice),
		url: fields.url,
		username: fields.username,
		password: passwordOf(fields, hasPassword),
		root_id: fields.rootId,
		path_map: { client: fields.mapClient, node: fields.mapNode }
	}
}

export function checkParams(fields: ClientFields, hasPassword: boolean): TorrentCheckParams {
	const client = clientOf(fields.choice)

	return fields.choice === 'qbittorrent'
		? { client, url: fields.url, username: fields.username, password: passwordOf(fields, hasPassword) }
		: { client, username: '' }
}
