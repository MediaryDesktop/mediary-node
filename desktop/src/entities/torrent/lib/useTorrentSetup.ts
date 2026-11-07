import { useUnit } from 'effector-react'

import { useNodeData } from '@infra/node'

import { torrentDebridQuery, torrentDownloadsQuery, torrentSourcesQuery } from '../model/model'

import { readyDebrid } from './clients'
import type { DebridService, TorrentClientKind } from './clients'

export interface TorrentSetup {
	loaded: boolean
	clientKind: TorrentClientKind
	clientService: string
	clientConfigured: boolean
	clientReachable: boolean | null
	clientError: string
	hasSources: boolean
	debrid: DebridService | undefined
}

export function useTorrentSetup(): TorrentSetup {
	const [downloads, sources, debrid] = useUnit([
		torrentDownloadsQuery.$data,
		torrentSourcesQuery.$data,
		torrentDebridQuery.$data
	])

	useNodeData(torrentDownloadsQuery, { enabled: !downloads })
	useNodeData(torrentSourcesQuery, { enabled: !sources })
	useNodeData(torrentDebridQuery, { enabled: !debrid })

	const client = downloads?.client

	return {
		loaded: Boolean(downloads && sources),
		clientKind: client?.kind ?? '',
		clientService: client?.service ?? '',
		clientConfigured: client?.configured ?? false,
		clientReachable: !client?.configured ? null : client.error ? false : client.reachable ? true : null,
		clientError: client?.error ?? '',
		hasSources: (sources?.sources ?? []).length > 0 || (sources?.plugins ?? 0) > 0,
		debrid: readyDebrid(debrid)
	}
}
