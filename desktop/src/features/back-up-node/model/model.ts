import { createMutation, createQuery, keepFresh } from '@farfetched/core'

import { nodeTopic } from '@infra/node'

import {
	backUpNowFx,
	deleteBackupFx,
	fetchBackupsFx,
	fetchDevicesFx,
	fetchSyncStatusFx,
	pairThisNodeFx,
	restoreBackupFx,
	revokeDeviceFx,
	unpairNodeFx
} from '../api/api'

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
