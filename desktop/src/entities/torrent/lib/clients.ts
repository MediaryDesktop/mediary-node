import type { TorrentDebrid, TorrentSettings } from '../api/api'

export type TorrentClientKind = TorrentSettings['client']

export type DebridKind = Exclude<TorrentDebrid['service'], ''>

export interface DebridService {
	kind: DebridKind
	name: string
	keyPage: string
	cacheCheck: boolean
}

export const DEBRID_SERVICES: readonly DebridService[] = [
	{ kind: 'torbox', name: 'TorBox', keyPage: 'torbox.app/settings', cacheCheck: true },
	{ kind: 'realdebrid', name: 'Real-Debrid', keyPage: 'real-debrid.com/apitoken', cacheCheck: false },
	{ kind: 'alldebrid', name: 'AllDebrid', keyPage: 'alldebrid.com/apikeys', cacheCheck: false },
	{ kind: 'premiumize', name: 'Premiumize', keyPage: 'premiumize.me/account', cacheCheck: true }
]

export function debridService(kind: string | null | undefined): DebridService | undefined {
	return DEBRID_SERVICES.find(service => service.kind === kind)
}

export function readyDebrid(debrid: TorrentDebrid | null | undefined): DebridService | undefined {
	return debrid?.ready ? debridService(debrid.service) : undefined
}
