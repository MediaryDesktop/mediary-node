import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { createEvent, createStore, sample } from 'effector'

import { nodeStreamResumed, nodeTopic } from '@infra/node'

import {
	addTorrentFx,
	checkTorrentClientFx,
	checkTorrentDebridFx,
	checkTorrentRuleFx,
	checkTorrentSourceFx,
	createTorrentSourceFx,
	deleteTorrentRuleFx,
	deleteTorrentSourceFx,
	fetchTorrentDebridFx,
	fetchTorrentDownloadsFx,
	fetchTorrentFilesFx,
	fetchTorrentProfileFx,
	fetchTorrentRuleFx,
	fetchTorrentRulesFx,
	fetchTorrentSettingsFx,
	fetchTorrentSourcesFx,
	pauseTorrentFx,
	putTorrentDebridFx,
	putTorrentProfileFx,
	putTorrentRuleFx,
	putTorrentSettingsFx,
	removeTorrentFx,
	resumeTorrentFx,
	searchTorrentsFx,
	selectTorrentFilesFx,
	updateTorrentSourceFx
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

export const torrentFilesQuery = createQuery({ effect: fetchTorrentFilesFx, name: 'torrentFiles' })

export const selectTorrentFilesMutation = createMutation({
	effect: selectTorrentFilesFx,
	name: 'selectTorrentFiles'
})

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
		nodeStreamResumed,
		addTorrentMutation.finished.success,
		pauseTorrentMutation.finished.finally,
		resumeTorrentMutation.finished.finally,
		removeTorrentMutation.finished.success,
		selectTorrentFilesMutation.finished.success
	],
	target: torrentDownloadsQuery.start
})

// The download whose files are on screen, or null.
export const torrentFilesOpened = createEvent<number>()
export const torrentFilesClosed = createEvent()

const $filesOf = createStore<number | null>(null)
	.on(torrentFilesOpened, (_, id) => id)
	.reset(torrentFilesClosed)

sample({ clock: torrentFilesOpened, target: [torrentFilesQuery.reset, torrentFilesQuery.start] })
sample({ clock: torrentFilesClosed, target: torrentFilesQuery.reset })

// A magnet's file list arrives with its metadata; until then the list is empty, so
// it is asked for again on every word from the node.
concurrency(torrentFilesQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: nodeTopic('torrent'),
	source: { id: $filesOf, data: torrentFilesQuery.$data },
	filter: ({ id, data }) => id !== null && (data?.files ?? []).length === 0,
	fn: ({ id }) => id as number,
	target: torrentFilesQuery.start
})

keepFresh(torrentSettingsQuery, { triggers: [putTorrentSettingsMutation.finished.success] })

// The debrid service is set up apart from the client: it plays torrents and
// marks cached releases whatever the client is.
export const torrentDebridQuery = createQuery({ effect: fetchTorrentDebridFx, name: 'torrentDebrid' })

export const putTorrentDebridMutation = createMutation({
	effect: putTorrentDebridFx,
	name: 'putTorrentDebrid'
})

export const checkTorrentDebridMutation = createMutation({
	effect: checkTorrentDebridFx,
	name: 'checkTorrentDebrid'
})

// Whether it is in use depends on the client, so either change asks again.
keepFresh(torrentDebridQuery, {
	triggers: [putTorrentDebridMutation.finished.success, putTorrentSettingsMutation.finished.success]
})

export const torrentSourcesQuery = createQuery({ effect: fetchTorrentSourcesFx, name: 'torrentSources' })

export const createTorrentSourceMutation = createMutation({
	effect: createTorrentSourceFx,
	name: 'createTorrentSource'
})

export const updateTorrentSourceMutation = createMutation({
	effect: updateTorrentSourceFx,
	name: 'updateTorrentSource'
})

export const deleteTorrentSourceMutation = createMutation({
	effect: deleteTorrentSourceFx,
	name: 'deleteTorrentSource'
})

export const checkTorrentSourceMutation = createMutation({
	effect: checkTorrentSourceFx,
	name: 'checkTorrentSource'
})

keepFresh(torrentSourcesQuery, {
	triggers: [
		createTorrentSourceMutation.finished.success,
		updateTorrentSourceMutation.finished.success,
		deleteTorrentSourceMutation.finished.success,
		// A plugin installed, turned on or off counts toward being able to search.
		nodeTopic('extension')
	]
})

export const torrentSearchQuery = createQuery({ effect: searchTorrentsFx, name: 'torrentSearch' })

// A new search makes the one still running moot.
concurrency(torrentSearchQuery, { strategy: 'TAKE_LATEST' })

export const torrentProfileQuery = createQuery({ effect: fetchTorrentProfileFx, name: 'torrentProfile' })

export const putTorrentProfileMutation = createMutation({
	effect: putTorrentProfileFx,
	name: 'putTorrentProfile'
})

keepFresh(torrentProfileQuery, { triggers: [putTorrentProfileMutation.finished.success] })

export const torrentRulesQuery = createQuery({ effect: fetchTorrentRulesFx, name: 'torrentRules' })

// One title's rule, for its page.
export const torrentRuleQuery = createQuery({ effect: fetchTorrentRuleFx, name: 'torrentRule' })

export const putTorrentRuleMutation = createMutation({ effect: putTorrentRuleFx, name: 'putTorrentRule' })

export const deleteTorrentRuleMutation = createMutation({
	effect: deleteTorrentRuleFx,
	name: 'deleteTorrentRule'
})

export const checkTorrentRuleMutation = createMutation({
	effect: checkTorrentRuleFx,
	name: 'checkTorrentRule'
})

const rulesChanged = nodeTopic('torrent').filter({ fn: event => event.payload?.reason === 'rules' })

keepFresh(torrentRulesQuery, {
	triggers: [
		rulesChanged,
		putTorrentRuleMutation.finished.success,
		deleteTorrentRuleMutation.finished.success
	]
})

keepFresh(torrentRuleQuery, {
	triggers: [
		rulesChanged,
		putTorrentRuleMutation.finished.success,
		deleteTorrentRuleMutation.finished.success
	]
})
