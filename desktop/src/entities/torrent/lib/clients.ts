import type { TorrentSettings } from '../api/api'

export type TorrentClientKind = TorrentSettings['client']

export type DebridKind = Extract<TorrentClientKind, 'torbox' | 'realdebrid' | 'alldebrid' | 'premiumize'>

export interface DebridService {
	kind: DebridKind
	name: string
	// Where the account's key is copied from, shown in the hint under the field.
	keyPage: string
	// Whether the service can say which releases it already holds.
	cacheCheck: boolean
}

// The debrid services the node can use as its torrent client, in the order the
// settings offer them: the one with a free plan first.
export const DEBRID_SERVICES: readonly DebridService[] = [
	{ kind: 'torbox', name: 'TorBox', keyPage: 'torbox.app/settings', cacheCheck: true },
	{ kind: 'realdebrid', name: 'Real-Debrid', keyPage: 'real-debrid.com/apitoken', cacheCheck: false },
	{ kind: 'alldebrid', name: 'AllDebrid', keyPage: 'alldebrid.com/apikeys', cacheCheck: false },
	{ kind: 'premiumize', name: 'Premiumize', keyPage: 'premiumize.me/account', cacheCheck: true }
]

export function debridService(kind: TorrentClientKind | undefined): DebridService | undefined {
	return DEBRID_SERVICES.find(service => service.kind === kind)
}

export function isDebrid(kind: TorrentClientKind | undefined): kind is DebridKind {
	return debridService(kind) !== undefined
}
