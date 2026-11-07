import { useUnit } from 'effector-react'
import { useState } from 'react'
import { MdRestore } from 'react-icons/md'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, formatDateTime, useUnitWatch } from '@shared/lib'
import { Button, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import type { SyncBackup } from '../../../api/api'
import { BACKUP_TOAST_ID } from '../../../config/toast'
import { backupsQuery, deleteBackupMutation } from '../../../model/model'

import styles from './BackupList.module.scss'
import { RestoreDialog } from './restore-dialog/RestoreDialog'

export function BackupList() {
	const { t, i18n } = useTranslation()
	const [restoring, setRestoring] = useState<SyncBackup | null>(null)

	const [backups, failed, remove, removing] = useUnit([
		backupsQuery.$data,
		backupsQuery.$failed,
		deleteBackupMutation.start,
		deleteBackupMutation.$pending
	])

	useNodeData(backupsQuery)

	useUnitWatch(deleteBackupMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.deleteFailed')), { id: BACKUP_TOAST_ID })
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
			<div className={styles.listSection}>
				<span className={styles.listLabel}>{t('backup.allBackups')}</span>

				<ul className={styles.list}>
					{backups.backups.map(backup => (
						<li key={backup.id} className={styles.item}>
							<div className={styles.details}>
								<span className={styles.when}>
									{formatDateTime(backup.created_at, i18n.language)}
								</span>
								<span className={styles.meta}>
									{backup.device_label} · {formatBytes(backup.size_bytes)}
								</span>
							</div>

							<div className={styles.itemActions}>
								<Button
									variant='ghost'
									size='small'
									startIcon={<MdRestore size={16} />}
									onClick={() => setRestoring(backup)}
								>
									{t('backup.restore')}
								</Button>
								<Button
									variant='glass-accent'
									size='small'
									iconOnly
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
			</div>

			<RestoreDialog backup={restoring} onClose={() => setRestoring(null)} />
		</>
	)
}
