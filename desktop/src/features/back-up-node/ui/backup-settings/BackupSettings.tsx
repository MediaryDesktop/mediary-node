import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoCloudOfflineOutline, IoCloudOutline } from 'react-icons/io5'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatDateTime, formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { returnAfterAuthRequested, sessionModel } from '@entities/session'

import { BACKUP_TOAST_ID } from '../../config/toast'
import {
	$updateRequired,
	$updateUrl,
	backUpNowMutation,
	clientGateMounted,
	pairMutation,
	syncStatusQuery,
	unpairMutation
} from '../../model/model'

import { BackupList } from './backup-list/BackupList'
import styles from './BackupSettings.module.scss'

export function BackupSettings() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const [account, status, requestReturn] = useUnit([
		sessionModel.$account,
		syncStatusQuery.$data,
		returnAfterAuthRequested
	])

	const leaveToAuth = (to: '/sign-in' | '/verify-email') => {
		requestReturn({ to: '/settings', search: { section: 'backup' } })
		navigate({ to })
	}

	const [updateRequired, updateUrl] = useUnit([$updateRequired, $updateUrl])

	const [pair, pairing, unpair, unpairing, backUp, backingUp] = useUnit([
		pairMutation.start,
		pairMutation.$pending,
		unpairMutation.start,
		unpairMutation.$pending,
		backUpNowMutation.start,
		backUpNowMutation.$pending
	])

	const mounted = useUnit(clientGateMounted)

	useEffect(() => {
		mounted()
	}, [mounted])

	useNodeData(syncStatusQuery)

	useUnitWatch(pairMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.pairFailed')), { id: BACKUP_TOAST_ID })
	)
	useUnitWatch(pairMutation.finished.success, () =>
		toast.success(t('backup.paired'), { id: BACKUP_TOAST_ID })
	)
	useUnitWatch(backUpNowMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.backUpFailed')), { id: BACKUP_TOAST_ID })
	)
	useUnitWatch(backUpNowMutation.finished.success, ({ result }) =>
		toast.success(t(result.created ? 'backup.backedUp' : 'backup.unchanged'), { id: BACKUP_TOAST_ID })
	)

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t('settings.backup.name')}</h3>
					<p className={styles.hint}>{t('settings.backup.hint')}</p>
				</div>
			</div>

			{updateRequired ? (
				<>
					<p className={styles.error}>{t('backup.banner.outdated')}</p>
					{updateUrl && (
						<div className={styles.actions}>
							<Button onClick={() => window.open(updateUrl, '_blank', 'noreferrer')}>
								{t('backup.banner.update')}
							</Button>
						</div>
					)}
				</>
			) : !account ? (
				<>
					<p className={styles.note}>{t('backup.signedOut')}</p>
					<div className={styles.actions}>
						<Button onClick={() => leaveToAuth('/sign-in')}>{t('backup.signIn')}</Button>
					</div>
				</>
			) : !account.email_verified ? (
				<>
					<p className={styles.note}>{t('backup.unverified')}</p>
					<div className={styles.actions}>
						<Button onClick={() => leaveToAuth('/verify-email')}>{t('backup.verify')}</Button>
					</div>
				</>
			) : !status ? null : !status.linked ? (
				<>
					<p className={styles.note}>{t('backup.off', { name: account.display_name })}</p>
					<div className={styles.actions}>
						<Button
							loading={pairing}
							startIcon={<IoCloudOutline size={16} />}
							onClick={() => pair()}
						>
							{t('backup.turnOn')}
						</Button>
					</div>
				</>
			) : (
				<>
					<p className={styles.banner}>
						<Icon name='common/info' size={18} />
						<span>{t('backup.note')}</span>
					</p>

					<div className={styles.lastBackup}>
						<span className={styles.badge}>
							<Icon name='common/clock' size={20} />
						</span>

						<span className={styles.lastBackupBody}>
							<span className={styles.lastBackupTitle}>
								{status.last_backup_at
									? t('backup.lastBackup', {
											when: formatRelativeTime(status.last_backup_at, i18n.language)
										})
									: t('backup.noBackupYet')}
							</span>
							{status.last_backup_at && (
								<span className={styles.lastBackupWhen}>
									{formatDateTime(status.last_backup_at, i18n.language)}
								</span>
							)}
						</span>

						<Button
							variant='primary'
							loading={backingUp}
							startIcon={<IoCloudOutline size={20} />}
							onClick={() => backUp()}
						>
							{t('backup.backUpNow')}
						</Button>
					</div>

					{status.last_error && <p className={styles.error}>{status.last_error}</p>}

					<BackupList />

					<div className={styles.footer}>
						<Button
							variant='glass-accent'
							size='small'
							startIcon={<IoCloudOfflineOutline size={16} />}
							disabled={unpairing}
							onClick={() => unpair()}
						>
							{t('backup.turnOff')}
						</Button>
					</div>
				</>
			)}
		</div>
	)
}
