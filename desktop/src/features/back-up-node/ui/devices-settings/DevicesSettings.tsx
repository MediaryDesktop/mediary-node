import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, Icon, toast } from '@shared/ui'

import { sessionModel } from '@entities/session'

import { devicesQuery, revokeDeviceMutation, syncStatusQuery } from '../../model/model'

import styles from './DevicesSettings.module.scss'

const TOAST_ID = 'devices-settings'

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
		toast.error(problemDetail(error, t('devices.revokeFailed')), { id: TOAST_ID })
	)

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t('settings.devices.name')}</h3>
					<p className={styles.hint}>{t('settings.devices.hint')}</p>
				</div>
			</div>

			{!verified ? (
				<p className={styles.note}>{t('devices.signedOut')}</p>
			) : failed ? (
				<p className={styles.note}>{t('devices.listFailed')}</p>
			) : !devices ? null : devices.devices.length === 0 ? (
				<p className={styles.note}>{t('devices.empty')}</p>
			) : (
				<>
					<p className={styles.banner}>
						<Icon name='common/info' size={18} />
						<span>{t('devices.note')}</span>
					</p>

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
										variant='secondary'
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
				</>
			)}
		</div>
	)
}
