import { createEffect } from 'effector'

import type { HttpRequestError } from '@shared/api'

import { createCloudRequestFx } from '@infra/cloud'
import type { CloudOperation, CloudSchemas } from '@infra/cloud'
import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type SyncStatus = NodeSchemas['SyncStatusOutputBody']
export type SyncBackup = NodeSchemas['SyncBackupBody']
export type Paired = NodeSchemas['SyncPairOutputBody']
export type BackupResult = NodeSchemas['SyncBackupNowOutputBody']
export type Device = CloudSchemas['DeviceBody']
export type CloudHealth = CloudSchemas['HealthOutputBody']

type PairingCode = CloudOperation<'createPairingCode'>['responses'][201]['content']['application/json']

export const fetchSyncStatusFx = createNodeRequestFx<void, SyncStatus>({ url: '/v1/sync/status' })

export const pairNodeFx = createNodeRequestFx<string, Paired>(code => ({
	url: '/v1/sync/pairing',
	method: 'POST',
	body: { code },
	timeout: 30_000,
	expectsUnauthorized: true
}))

export const unpairNodeFx = createNodeRequestFx<void, void>({ url: '/v1/sync/pairing', method: 'DELETE' })

export const backUpNowFx = createNodeRequestFx<void, BackupResult>({
	url: '/v1/sync/backups',
	method: 'POST',
	timeout: 120_000,
	expectsUnauthorized: true
})

export const fetchBackupsFx = createNodeRequestFx<void, { backups: SyncBackup[] }>({
	url: '/v1/sync/backups',
	timeout: 30_000,
	expectsUnauthorized: true
})

export const restoreBackupFx = createNodeRequestFx<string, void>(id => ({
	url: `/v1/sync/backups/${encodeURIComponent(id)}/restore`,
	method: 'POST',
	timeout: 120_000,
	expectsUnauthorized: true
}))

const createPairingCodeFx = createCloudRequestFx<void, PairingCode>({
	url: '/v1/account/devices/pairing-codes',
	method: 'POST'
})

export const pairThisNodeFx = createEffect<void, Paired, HttpRequestError>(async () => {
	const { code } = await createPairingCodeFx()

	return pairNodeFx(code)
})

export const fetchDevicesFx = createCloudRequestFx<void, { devices: Device[] }>({
	url: '/v1/account/devices'
})

export const revokeDeviceFx = createCloudRequestFx<string, void>(id => ({
	url: `/v1/account/devices/${encodeURIComponent(id)}`,
	method: 'DELETE'
}))

export const deleteBackupFx = createCloudRequestFx<string, void>(id => ({
	url: `/v1/backups/${encodeURIComponent(id)}`,
	method: 'DELETE'
}))

export const fetchCloudHealthFx = createCloudRequestFx<void, CloudHealth>({ url: '/v1/health' })

export const fetchAppVersionFx = createEffect<void, string>(() => window.mediary.app.version())
