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

export const torrentFilesOpened = createEvent<number>()
export const torrentFilesClosed = createEvent()

const $filesOf = createStore<number | null>(null)
	.on(torrentFilesOpened, (_, id) => id)
	.reset(torrentFilesClosed)

sample({ clock: torrentFilesOpened, target: [torrentFilesQuery.reset, torrentFilesQuery.start] })
sample({ clock: torrentFilesClosed, target: torrentFilesQuery.reset })

concurrency(torrentFilesQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: nodeTopic('torrent'),
	source: { id: $filesOf, data: torrentFilesQuery.$data },
	filter: ({ id, data }) => id !== null && (data?.files ?? []).length === 0,
	fn: ({ id }) => id as number,
	target: torrentFilesQuery.start
})

keepFresh(torrentSettingsQuery, { triggers: [putTorrentSettingsMutation.finished.success] })

export const torrentDebridQuery = createQuery({ effect: fetchTorrentDebridFx, name: 'torrentDebrid' })

export const putTorrentDebridMutation = createMutation({
	effect: putTorrentDebridFx,
	name: 'putTorrentDebrid'
})

export const checkTorrentDebridMutation = createMutation({
	effect: checkTorrentDebridFx,
	name: 'checkTorrentDebrid'
})

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
		nodeTopic('extension')
	]
})

export const torrentSearchQuery = createQuery({ effect: searchTorrentsFx, name: 'torrentSearch' })

concurrency(torrentSearchQuery, { strategy: 'TAKE_LATEST' })

export const torrentProfileQuery = createQuery({ effect: fetchTorrentProfileFx, name: 'torrentProfile' })

export const putTorrentProfileMutation = createMutation({
	effect: putTorrentProfileFx,
	name: 'putTorrentProfile'
})

keepFresh(torrentProfileQuery, { triggers: [putTorrentProfileMutation.finished.success] })

export const torrentRulesQuery = createQuery({ effect: fetchTorrentRulesFx, name: 'torrentRules' })

export const torrentRuleQuery = createQuery({ effect: fetchTorrentRuleFx, name: 'torrentRule' })

concurrency(torrentRuleQuery, { strategy: 'TAKE_LATEST' })

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
