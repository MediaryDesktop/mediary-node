import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, formatDateTime, formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, Icon, Modal, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { returnAfterAuthRequested, sessionModel } from '@entities/session'

import type { SyncBackup } from '../../api/api'
import {
	$updateRequired,
	$updateUrl,
	backUpNowMutation,
	backupsQuery,
	clientGateMounted,
	deleteBackupMutation,
	pairMutation,
	restoreMutation,
	syncStatusQuery,
	unpairMutation
} from '../../model/model'

import styles from './BackupSettings.module.scss'

const TOAST_ID = 'backup-settings'

export function BackupSettings() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const [account, nodeReady, status, loadStatus, requestReturn] = useUnit([
		sessionModel.$account,
		$nodeReady,
		syncStatusQuery.$data,
		syncStatusQuery.start,
		returnAfterAuthRequested
	])

	// Back to this very section once the user has signed in or confirmed the
	// address — that is what they left for.
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

	useEffect(() => {
		if (nodeReady) {
			loadStatus()
		}
	}, [loadStatus, nodeReady])

	useUnitWatch(pairMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.pairFailed')), { id: TOAST_ID })
	)
	useUnitWatch(pairMutation.finished.success, () => toast.success(t('backup.paired'), { id: TOAST_ID }))
	useUnitWatch(backUpNowMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.backUpFailed')), { id: TOAST_ID })
	)
	useUnitWatch(backUpNowMutation.finished.success, ({ result }) =>
		toast.success(t(result.created ? 'backup.backedUp' : 'backup.unchanged'), { id: TOAST_ID })
	)

	if (updateRequired) {
		return (
			<div className={styles.root}>
				<p className={styles.error}>{t('backup.banner.outdated')}</p>
				{updateUrl && (
					<div className={styles.actions}>
						<Button onClick={() => window.open(updateUrl, '_blank', 'noreferrer')}>
							{t('backup.banner.update')}
						</Button>
					</div>
				)}
			</div>
		)
	}

	if (!account) {
		return (
			<div className={styles.root}>
				<p className={styles.note}>{t('backup.signedOut')}</p>
				<div className={styles.actions}>
					<Button onClick={() => leaveToAuth('/sign-in')}>{t('backup.signIn')}</Button>
				</div>
			</div>
		)
	}

	if (!account.email_verified) {
		return (
			<div className={styles.root}>
				<p className={styles.note}>{t('backup.unverified')}</p>
				<div className={styles.actions}>
					<Button onClick={() => leaveToAuth('/verify-email')}>{t('backup.verify')}</Button>
				</div>
			</div>
		)
	}

	if (!status) {
		return null
	}

	if (!status.linked) {
		return (
			<div className={styles.root}>
				<p className={styles.note}>{t('backup.off', { name: account.display_name })}</p>
				<div className={styles.actions}>
					<Button
						loading={pairing}
						startIcon={<Icon name='common/cloud' size={16} />}
						onClick={() => pair()}
					>
						{t('backup.turnOn')}
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<p className={styles.state}>
				{status.last_backup_at
					? t('backup.lastBackup', {
							when: formatRelativeTime(status.last_backup_at, i18n.language)
						})
					: t('backup.noBackupYet')}
			</p>

			{status.last_error && <p className={styles.error}>{status.last_error}</p>}

			<div className={styles.actions}>
				<Button loading={backingUp} onClick={() => backUp()}>
					{t('backup.backUpNow')}
				</Button>

				<Button variant='ghost' size='small' disabled={unpairing} onClick={() => unpair()}>
					{t('backup.turnOff')}
				</Button>
			</div>

			<BackupList thisDevice={status.device_id} />

			<p className={styles.note}>{t('backup.note')}</p>
		</div>
	)
}

function BackupList({ thisDevice }: { thisDevice?: string }) {
	const { t, i18n } = useTranslation()
	const [restoring, setRestoring] = useState<SyncBackup | null>(null)

	const [backups, load, failed, remove, removing] = useUnit([
		backupsQuery.$data,
		backupsQuery.start,
		backupsQuery.$failed,
		deleteBackupMutation.start,
		deleteBackupMutation.$pending
	])

	useEffect(() => load(), [load])

	useUnitWatch(deleteBackupMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.deleteFailed')), { id: TOAST_ID })
	)

	if (failed) {
		return <p className={styles.note}>{t('backup.listFailed')}</p>
	}

	if (!backups) {
		return null
	}

	if (backups.backups.length === 0) {
		return <p className={styles.note}>{t('backup.empty')}</p>
	}

	return (
		<>
			<ul className={styles.list}>
				{backups.backups.map(backup => (
					<li key={backup.id} className={styles.item}>
						<div className={styles.details}>
							<span className={styles.when}>
								{formatDateTime(backup.created_at, i18n.language)}
							</span>
							<span className={styles.meta}>
								{backup.device_id === thisDevice
									? t('backup.thisDevice', { name: backup.device_label })
									: backup.device_label}
								{' · '}
								{formatBytes(backup.size_bytes)}
							</span>
						</div>

						<div className={styles.itemActions}>
							<Button variant='secondary' size='small' onClick={() => setRestoring(backup)}>
								{t('backup.restore')}
							</Button>
							<Button
								variant='ghost'
								size='small'
								disabled={removing}
								aria-label={t('backup.delete')}
								onClick={() => remove(backup.id)}
							>
								<Icon name='common/trash' size={16} />
							</Button>
						</div>
					</li>
				))}
			</ul>

			<RestoreDialog backup={restoring} onClose={() => setRestoring(null)} />
		</>
	)
}

function RestoreDialog({ backup, onClose }: { backup: SyncBackup | null; onClose: () => void }) {
	const { t, i18n } = useTranslation()
	const [restore, restoring] = useUnit([restoreMutation.start, restoreMutation.$pending])

	useUnitWatch(restoreMutation.finished.success, () => {
		toast.success(t('backup.restored'), { id: TOAST_ID })
		onClose()
	})
	useUnitWatch(restoreMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.restoreFailed')), { id: TOAST_ID })
	)

	return (
		<Modal
			open={backup !== null}
			onOpenChange={next => !next && !restoring && onClose()}
			size='sm'
			title={t('backup.restoreTitle')}
			description={
				backup
					? t('backup.restoreHint', {
							device: backup.device_label,
							when: formatDateTime(backup.created_at, i18n.language)
						})
					: undefined
			}
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={restoring}>
						{t('common.cancel')}
					</Button>

					<Button
						variant='primary'
						loading={restoring}
						onClick={() => backup && restore(backup.id)}
					>
						{t('backup.restore')}
					</Button>
				</>
			}
		/>
	)
}
