import type { TorrentSource, TorrentSourceBody, TorrentSourceCheckParams } from '@entities/torrent'

export interface SourceFields {
	name: string
	url: string
	apiKey: string
}

export const EMPTY_FIELDS: SourceFields = { name: '', url: '', apiKey: '' }

export function fieldsOf(source: TorrentSource): SourceFields {
	return { name: source.name, url: source.url, apiKey: '' }
}

// An empty key on a source that already has one means "keep it", so it is left
// out of the request rather than sent as a new, empty key.
function keyOf(fields: SourceFields, source: TorrentSource | null): string | undefined {
	return source && fields.apiKey === '' ? undefined : fields.apiKey
}

export function bodyOf(fields: SourceFields, source: TorrentSource | null): TorrentSourceBody {
	return { name: fields.name, url: fields.url, api_key: keyOf(fields, source) }
}

export function checkParamsOf(fields: SourceFields, source: TorrentSource | null): TorrentSourceCheckParams {
	return { source_id: source?.id, url: fields.url, api_key: keyOf(fields, source) }
}

export function canSubmit(fields: SourceFields): boolean {
	return fields.name.trim() !== '' && fields.url.trim() !== ''
}
