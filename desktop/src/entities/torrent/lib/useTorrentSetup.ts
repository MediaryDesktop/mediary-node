import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { $nodeReady } from '@infra/node'

import { torrentDebridQuery, torrentDownloadsQuery, torrentSourcesQuery } from '../model/model'

import { readyDebrid } from './clients'
import type { DebridService, TorrentClientKind } from './clients'

export interface TorrentSetup {
	// False until both answers are in, so nothing warns about a setup still loading.
	loaded: boolean
	clientKind: TorrentClientKind
	// With the debrid client, the service it downloads through.
	clientService: string
	clientConfigured: boolean
	// Null while the node has not asked the client yet.
	clientReachable: boolean | null
	clientError: string
	hasSources: boolean
	// The debrid service ready to play torrents and mark cached releases,
	// whatever the client; undefined while none is set up.
	debrid: DebridService | undefined
}

// What torrents need before they work: a client to download with and, for search
// and the rules, a source to search. Every torrent screen reads it the same way.
export function useTorrentSetup(): TorrentSetup {
	const [downloads, sources, debrid, loadDownloads, loadSources, loadDebrid, nodeReady] = useUnit([
		torrentDownloadsQuery.$data,
		torrentSourcesQuery.$data,
		torrentDebridQuery.$data,
		torrentDownloadsQuery.start,
		torrentSourcesQuery.start,
		torrentDebridQuery.start,
		$nodeReady
	])

	useEffect(() => {
		if (!nodeReady) {
			return
		}
		if (!downloads) {
			loadDownloads()
		}
		if (!sources) {
			loadSources()
		}
		if (!debrid) {
			loadDebrid()
		}
	}, [nodeReady, downloads, sources, debrid, loadDownloads, loadSources, loadDebrid])

	const client = downloads?.client

	return {
		loaded: Boolean(downloads && sources),
		clientKind: client?.kind ?? '',
		clientService: client?.service ?? '',
		clientConfigured: client?.configured ?? false,
		clientReachable: !client?.configured ? null : client.error ? false : client.reachable ? true : null,
		clientError: client?.error ?? '',
		hasSources: (sources?.sources ?? []).length > 0,
		debrid: readyDebrid(debrid)
	}
}
