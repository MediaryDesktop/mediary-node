import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { sample } from 'effector'

import { nodeTopic } from '@infra/node'

import {
	addTorrentFx,
	checkTorrentClientFx,
	fetchTorrentDownloadsFx,
	fetchTorrentSettingsFx,
	pauseTorrentFx,
	putTorrentSettingsFx,
	removeTorrentFx,
	resumeTorrentFx
} from '../api/api'

export const torrentDownloadsQuery = createQuery({
	effect: fetchTorrentDownloadsFx,
	name: 'torrentDownloads'
})

export const torrentSettingsQuery = createQuery({ effect: fetchTorrentSettingsFx, name: 'torrentSettings' })

export const addTorrentMutation = createMutation({ effect: addTorrentFx, name: 'addTorrent' })

export const pauseTorrentMutation = createMutation({ effect: pauseTorrentFx, name: 'pauseTorrent' })

export const resumeTorrentMutation = createMutation({ effect: resumeTorrentFx, name: 'resumeTorrent' })

export const removeTorrentMutation = createMutation({ effect: removeTorrentFx, name: 'removeTorrent' })

export const putTorrentSettingsMutation = createMutation({
	effect: putTorrentSettingsFx,
	name: 'putTorrentSettings'
})

export const checkTorrentClientMutation = createMutation({
	effect: checkTorrentClientFx,
	name: 'checkTorrentClient'
})

// The node announces every poll of the client while something downloads, and the
// list asks again on each; only the answer to the latest may stand.
concurrency(torrentDownloadsQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: [
		nodeTopic('torrent'),
		addTorrentMutation.finished.success,
		pauseTorrentMutation.finished.finally,
		resumeTorrentMutation.finished.finally,
		removeTorrentMutation.finished.success
	],
	target: torrentDownloadsQuery.start
})

keepFresh(torrentSettingsQuery, { triggers: [putTorrentSettingsMutation.finished.success] })
