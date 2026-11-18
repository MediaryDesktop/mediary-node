import { createQuery } from '@farfetched/core'
import { combine, createEffect, createEvent, createStore, sample } from 'effector'

import { fetchCloudHealthFx } from '@infra/cloud'

import { sessionModel } from '@entities/session'
import { exportBackupMutation, fetchSyncStatusFx, pairMutation } from '@entities/sync'
import type { ExportedBackup } from '@entities/sync'

import { isOlderThan } from '../lib/version'

// The node hands the backup over as bytes; where they land on disk is the
// user's choice, asked by the shell. False when they cancelled.
const saveBackupFileFx = createEffect(({ file_name, data }: ExportedBackup) =>
	window.mediary.dialog.saveFile(file_name, data)
)

sample({ clock: exportBackupMutation.finished.success, fn: ({ result }) => result, target: saveBackupFileFx })

export const backupFileSaved = sample({
	clock: saveBackupFileFx.doneData,
	filter: Boolean,
	fn: () => undefined
})

export const backupFileSaveFailed = saveBackupFileFx.fail.map(() => undefined)

// Signing in with a verified email pairs this node with the account, unless it
// already is. It listens to the session — another entity — so it is wired here
// rather than in entities/sync.
const linkedFx = createEffect(async () => (await fetchSyncStatusFx()).linked)

sample({
	clock: [sessionModel.authenticated, sessionModel.emailVerified],
	filter: account => account.email_verified,
	target: linkedFx
})

sample({ clock: linkedFx.doneData, filter: linked => !linked, target: pairMutation.start })

const cloudHealthQuery = createQuery({ effect: fetchCloudHealthFx, name: 'cloudHealth' })

const fetchAppVersionFx = createEffect<void, string>(() => window.mediary.app.version())

export const clientGateMounted = createEvent()

const $appVersion = createStore<string | null>(null).on(fetchAppVersionFx.doneData, (_, version) => version)

sample({ clock: clientGateMounted, target: [cloudHealthQuery.start, fetchAppVersionFx] })

export const $updateRequired = combine(cloudHealthQuery.$data, $appVersion, (health, version) => {
	const minimum = health?.client.min_supported

	return Boolean(minimum && version && isOlderThan(version, minimum))
})

export const $updateUrl = cloudHealthQuery.$data.map(health => health?.client.update_url ?? null)
