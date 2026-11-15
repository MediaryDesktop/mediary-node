import { combine, createEvent, createStore, sample } from 'effector'

import { problemDetail } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'

import { libraryModel } from '@entities/library-item'
import { readyDebrid, torrentDebridQuery } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import { checkParams, fieldsOf, hasProblems, problemsOf, settingsUpdate } from '../lib/form'
import type { ClientChoice, ClientFields } from '../lib/form'

import { clientCheck, clientSave, FOLDER_REQUESTER } from './model'

export type CheckState = { ok: true; version: string } | { ok: false; problem: string } | null

type ConnectionField = 'url' | 'username' | 'password'
type MappingField = 'mapClient' | 'mapNode'

// The torrent client form: what the user has typed, whether it can be saved,
// and what the last check said about exactly that.
export const clientForm = atom(() => {
	const opened = createEvent<TorrentSettings>()
	const reset = createEvent()
	const picked = createEvent<ClientChoice>()
	const connectionChanged = createEvent<{ field: ConnectionField; value: string }>()
	const mappingChanged = createEvent<{ field: MappingField; value: string }>()
	const folderPicked = createEvent<number>()
	const checkRequested = createEvent()
	const submitted = createEvent()

	const $settings = createStore<TorrentSettings | null>(null)
		.on(opened, (_, settings) => settings)
		.on(clientSave.succeeded, (_, { result }) => result)

	const $fields = createStore<ClientFields | null>(null)
		.on(opened, (_, settings) => fieldsOf(settings))
		.on(clientSave.succeeded, (_, { result }) => fieldsOf(result))
		.on(picked, (fields, choice) => fields && { ...fields, choice })
		.on(connectionChanged, (fields, { field, value }) => fields && { ...fields, [field]: value })
		.on(mappingChanged, (fields, { field, value }) => fields && { ...fields, [field]: value })
		.on(folderPicked, (fields, rootId) => fields && { ...fields, rootId })

	sample({ clock: reset, source: $settings, filter: Boolean, target: opened })

	sample({
		clock: libraryModel.rootAdded,
		filter: ({ requester }) => requester === FOLDER_REQUESTER,
		fn: ({ root }) => root.id,
		target: folderPicked
	})

	const $debridReady = torrentDebridQuery.$data.map(debrid => readyDebrid(debrid) !== undefined)

	const $problems = combine($fields, $debridReady, (fields, debridReady) =>
		fields ? problemsOf(fields, debridReady) : null
	)

	const $canSave = combine(
		$problems,
		clientSave.$pending,
		(problems, saving) => problems !== null && !hasProblems(problems) && !saving
	)

	// A check is about the client and the connection fields it was run with.
	const $check = createStore<CheckState>(null)
		.on(clientCheck.succeeded, (_, { result }) => ({ ok: true, version: result.version }))
		.on(clientCheck.failed, (_, { error }) => ({
			ok: false,
			problem: problemDetail(error, translate('torrents.client.notConfigured'))
		}))
		.reset(opened, picked, connectionChanged, checkRequested)

	sample({ clock: [opened, picked, connectionChanged], target: clientCheck.forgotten })

	interface Filled {
		fields: ClientFields
		settings: TorrentSettings
	}

	const $filled = combine($fields, $settings, (fields, settings): Filled | null =>
		fields && settings ? { fields, settings } : null
	)
	const $submittable = combine($filled, $canSave, (filled, canSave) => (canSave ? filled : null))

	sample({
		clock: checkRequested,
		source: $filled,
		filter: (filled: Filled | null): filled is Filled => filled !== null,
		fn: ({ fields, settings }) => checkParams(fields, settings.has_password),
		target: clientCheck.sent
	})

	sample({
		clock: submitted,
		source: $submittable,
		filter: (filled: Filled | null): filled is Filled => filled !== null,
		fn: ({ fields, settings }) => settingsUpdate(fields, settings.has_password),
		target: clientSave.sent
	})

	return {
		opened,
		reset,
		picked,
		connectionChanged,
		mappingChanged,
		folderPicked,
		checkRequested,
		submitted,
		$settings,
		$fields,
		$problems,
		$canSave,
		$check,
		$saving: clientSave.$pending,
		$checking: clientCheck.$pending,
		saveFailed: clientSave.failed
	}
})
