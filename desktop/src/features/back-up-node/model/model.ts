import { createMutation, createQuery, keepFresh } from '@farfetched/core'
import { combine, createEvent, createStore, sample } from 'effector'

import { nodeTopic } from '@infra/node'

import {
	backUpNowFx,
	deleteBackupFx,
	fetchAppVersionFx,
	fetchBackupsFx,
	fetchCloudHealthFx,
	fetchDevicesFx,
	fetchSyncStatusFx,
	pairThisNodeFx,
	restoreBackupFx,
	revokeDeviceFx,
	unpairNodeFx
} from '../api/api'
import { isOlderThan } from '../lib/version'

export const syncStatusQuery = createQuery({ effect: fetchSyncStatusFx, name: 'syncStatus' })

export const backupsQuery = createQuery({ effect: fetchBackupsFx, name: 'backups' })

export const devicesQuery = createQuery({ effect: fetchDevicesFx, name: 'devices' })

export const pairMutation = createMutation({ effect: pairThisNodeFx, name: 'pairNode' })

export const unpairMutation = createMutation({ effect: unpairNodeFx, name: 'unpairNode' })

export const backUpNowMutation = createMutation({ effect: backUpNowFx, name: 'backUpNow' })

export const restoreMutation = createMutation({ effect: restoreBackupFx, name: 'restoreBackup' })

export const deleteBackupMutation = createMutation({ effect: deleteBackupFx, name: 'deleteBackup' })

export const revokeDeviceMutation = createMutation({ effect: revokeDeviceFx, name: 'revokeDevice' })

// The node announces every pairing, upload and restore on its sync topic,
// including the automatic ones nobody clicked for.
const syncChanged = nodeTopic('sync')

keepFresh(syncStatusQuery, { triggers: [syncChanged] })

keepFresh(backupsQuery, {
	triggers: [syncChanged, deleteBackupMutation.finished.success]
})

keepFresh(devicesQuery, {
	triggers: [pairMutation.finished.success, revokeDeviceMutation.finished.success]
})

export const cloudHealthQuery = createQuery({ effect: fetchCloudHealthFx, name: 'cloudHealth' })

export const clientGateMounted = createEvent()

const $appVersion = createStore<string | null>(null).on(fetchAppVersionFx.doneData, (_, version) => version)

sample({ clock: clientGateMounted, target: [cloudHealthQuery.start, fetchAppVersionFx] })

// Only backups depend on the cloud, so only backups stop for a build the cloud
// no longer serves; the player, the library and the tracker never ask it.
export const $updateRequired = combine(cloudHealthQuery.$data, $appVersion, (health, version) => {
	const minimum = health?.client.min_supported

	return Boolean(minimum && version && isOlderThan(version, minimum))
})

export const $updateUrl = cloudHealthQuery.$data.map(health => health?.client.update_url ?? null)
