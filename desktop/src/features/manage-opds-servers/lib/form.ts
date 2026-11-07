export interface ServerFields {
	name: string
	url: string
	username: string
	password: string
}

export interface EditedServer {
	id: number
	name: string
	url: string
	username?: string
	has_password: boolean
}

export interface ServerBody {
	name: string
	url: string
	username?: string
	password?: string
}

export interface CheckParams {
	server_id?: number
	url: string
	username?: string
	password?: string
}

export const EMPTY_FIELDS: ServerFields = { name: '', url: '', username: '', password: '' }

export function fieldsOf(server: EditedServer | null): ServerFields {
	return server
		? { name: server.name, url: server.url, username: server.username ?? '', password: '' }
		: EMPTY_FIELDS
}

// An empty password on a server that already has one means "keep it", so it is
// left out of the request rather than sent as a new, empty password.
function passwordOf(fields: ServerFields, server: EditedServer | null): string | undefined {
	return server && fields.password === '' ? undefined : fields.password
}

export function bodyOf(fields: ServerFields, server: EditedServer | null): ServerBody {
	return {
		name: fields.name,
		url: fields.url,
		username: fields.username,
		password: passwordOf(fields, server)
	}
}

export function checkParamsOf(fields: ServerFields, server: EditedServer | null): CheckParams {
	return {
		server_id: server?.id,
		url: fields.url,
		username: fields.username,
		password: passwordOf(fields, server)
	}
}

export function canSubmit(fields: ServerFields): boolean {
	return fields.name.trim() !== '' && fields.url.trim() !== ''
}
