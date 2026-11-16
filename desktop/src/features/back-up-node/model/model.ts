import { createMutation, createQuery, keepFresh } from '@farfetched/core'
import { combine, createEffect, createEvent, createStore, sample } from 'effector'

import { nodeTopic } from '@infra/node'

import { sessionModel } from '@entities/session'

import {
	backUpNowFx,
	deleteBackupFx,
	exportBackupFx,
	fetchAppVersionFx,
	fetchBackupsFx,
	fetchCloudHealthFx,
	fetchDevicesFx,
	fetchSyncStatusFx,
	importBackupFileFx,
	pairThisNodeFx,
	restoreBackupFx,
	revokeDeviceFx,
	unpairNodeFx
} from '../api/api'
import type { ExportedBackup } from '../api/api'
import { isOlderThan } from '../lib/version'

export const syncStatusQuery = createQuery({ effect: fetchSyncStatusFx, name: 'syncStatus' })

export const backupsQuery = createQuery({ effect: fetchBackupsFx, name: 'backups' })

export const devicesQuery = createQuery({ effect: fetchDevicesFx, name: 'devices' })

export const pairMutation = createMutation({ effect: pairThisNodeFx, name: 'pairNode' })

export const unpairMutation = createMutation({ effect: unpairNodeFx, name: 'unpairNode' })

export const backUpNowMutation = createMutation({ effect: backUpNowFx, name: 'backUpNow' })

export const restoreMutation = createMutation({ effect: restoreBackupFx, name: 'restoreBackup' })

export const exportBackupMutation = createMutation({ effect: exportBackupFx, name: 'exportBackup' })

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

export const importBackupMutation = createMutation({ effect: importBackupFileFx, name: 'importBackup' })

export const deleteBackupMutation = createMutation({ effect: deleteBackupFx, name: 'deleteBackup' })

export const revokeDeviceMutation = createMutation({ effect: revokeDeviceFx, name: 'revokeDevice' })

const syncChanged = nodeTopic('sync')

keepFresh(syncStatusQuery, { triggers: [syncChanged] })

keepFresh(backupsQuery, {
	triggers: [syncChanged, deleteBackupMutation.finished.success]
})

keepFresh(devicesQuery, {
	triggers: [pairMutation.finished.success, revokeDeviceMutation.finished.success]
})

const linkedFx = createEffect(async () => (await fetchSyncStatusFx()).linked)

sample({
	clock: [sessionModel.authenticated, sessionModel.emailVerified],
	filter: account => account.email_verified,
	target: linkedFx
})

sample({ clock: linkedFx.doneData, filter: linked => !linked, target: pairMutation.start })

export const cloudHealthQuery = createQuery({ effect: fetchCloudHealthFx, name: 'cloudHealth' })

export const clientGateMounted = createEvent()

const $appVersion = createStore<string | null>(null).on(fetchAppVersionFx.doneData, (_, version) => version)

sample({ clock: clientGateMounted, target: [cloudHealthQuery.start, fetchAppVersionFx] })

export const $updateRequired = combine(cloudHealthQuery.$data, $appVersion, (health, version) => {
	const minimum = health?.client.min_supported

	return Boolean(minimum && version && isOlderThan(version, minimum))
})

export const $updateUrl = cloudHealthQuery.$data.map(health => health?.client.update_url ?? null)
