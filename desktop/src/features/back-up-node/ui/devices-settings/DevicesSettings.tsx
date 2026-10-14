import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, toast } from '@shared/ui'

import { sessionModel } from '@entities/session'

import { devicesQuery, revokeDeviceMutation, syncStatusQuery } from '../../model/model'
import styles from '../backup-settings/BackupSettings.module.scss'

// The account's paired nodes. Revoking one is the answer to a lost laptop: its
// token stops working at once, while its backups stay.
export function DevicesSettings() {
	const { t, i18n } = useTranslation()

	const [account, devices, load, failed, status, revoke, revoking] = useUnit([
		sessionModel.$account,
		devicesQuery.$data,
		devicesQuery.start,
		devicesQuery.$failed,
		syncStatusQuery.$data,
		revokeDeviceMutation.start,
		revokeDeviceMutation.$pending
	])

	const verified = account?.email_verified === true

	useEffect(() => {
		if (verified) {
			load()
		}
	}, [load, verified])

	useUnitWatch(revokeDeviceMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('devices.revokeFailed')), { id: 'devices-settings' })
	)

	if (!verified) {
		return <p className={styles.note}>{t('devices.signedOut')}</p>
	}

	if (failed) {
		return <p className={styles.note}>{t('devices.listFailed')}</p>
	}

	if (!devices) {
		return null
	}

	if (devices.devices.length === 0) {
		return <p className={styles.note}>{t('devices.empty')}</p>
	}

	return (
		<div className={styles.root}>
			<ul className={styles.list}>
				{devices.devices.map(device => (
					<li key={device.id} className={styles.item}>
						<div className={styles.details}>
							<span className={styles.when}>
								{device.id === status?.device_id
									? t('devices.thisDevice', { name: device.label })
									: device.label}
							</span>
							<span className={styles.meta}>
								{t('devices.lastSeen', {
									when: formatRelativeTime(device.last_seen_at, i18n.language)
								})}
							</span>
						</div>

						<div className={styles.itemActions}>
							<Button
								variant='ghost'
								size='small'
								disabled={revoking}
								onClick={() => revoke(device.id)}
							>
								{t('devices.revoke')}
							</Button>
						</div>
					</li>
				))}
			</ul>

			<p className={styles.note}>{t('devices.note')}</p>
		</div>
	)
}
