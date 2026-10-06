import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { $nodeReady } from '@infra/node'

import { torrentDownloadsQuery, torrentSourcesQuery } from '../model/model'

export interface TorrentSetup {
	// False until both answers are in, so nothing warns about a setup still loading.
	loaded: boolean
	clientKind: '' | 'qbittorrent' | 'embedded'
	clientConfigured: boolean
	// Null while the node has not asked the client yet.
	clientReachable: boolean | null
	clientError: string
	hasSources: boolean
}

// What torrents need before they work: a client to download with and, for search
// and the rules, a source to search. Every torrent screen reads it the same way.
export function useTorrentSetup(): TorrentSetup {
	const [downloads, sources, loadDownloads, loadSources, nodeReady] = useUnit([
		torrentDownloadsQuery.$data,
		torrentSourcesQuery.$data,
		torrentDownloadsQuery.start,
		torrentSourcesQuery.start,
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
	}, [nodeReady, downloads, sources, loadDownloads, loadSources])

	const client = downloads?.client

	return {
		loaded: Boolean(downloads && sources),
		clientKind: client?.kind ?? '',
		clientConfigured: client?.configured ?? false,
		clientReachable: !client?.configured ? null : client.error ? false : client.reachable ? true : null,
		clientError: client?.error ?? '',
		hasSources: (sources?.sources ?? []).length > 0
	}
}
