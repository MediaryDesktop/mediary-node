import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { MdFileDownload, MdFileUpload } from 'react-icons/md'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Modal, toast } from '@shared/ui'

import { BACKUP_TOAST_ID } from '../../../config/toast'
import { exportBackupMutation, importBackupMutation } from '../../../model/model'

import styles from './FileBackup.module.scss'

export function FileBackup() {
	const { t } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const [picked, setPicked] = useState<File | null>(null)

	const [save, saving, restore, restoring] = useUnit([
		exportBackupMutation.start,
		exportBackupMutation.$pending,
		importBackupMutation.start,
		importBackupMutation.$pending
	])

	useUnitWatch(exportBackupMutation.finished.success, ({ result }) => {
		window.mediary.dialog
			.saveFile(result.file_name, result.data)
			.then(saved => saved && toast.success(t('backup.file.saved'), { id: BACKUP_TOAST_ID }))
			.catch(() => toast.error(t('backup.file.saveFailed'), { id: BACKUP_TOAST_ID }))
	})
	useUnitWatch(exportBackupMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.file.saveFailed')), { id: BACKUP_TOAST_ID })
	)
	useUnitWatch(importBackupMutation.finished.success, () => {
		toast.success(t('backup.restored'), { id: BACKUP_TOAST_ID })
		setPicked(null)
	})
	useUnitWatch(importBackupMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.file.restoreFailed')), { id: BACKUP_TOAST_ID })
	)

	const onPick = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null

		// Cleared so that choosing the same file again fires change again.
		event.target.value = ''

		if (file) {
			setPicked(file)
		}
	}

	return (
		<section className={styles.root}>
			<div className={styles.text}>
				<h4 className={styles.title}>{t('backup.file.title')}</h4>
				<p className={styles.hint}>{t('backup.file.hint')}</p>
			</div>

			<div className={styles.actions}>
				<Button
					variant='secondary'
					size='small'
					loading={saving}
					startIcon={<MdFileDownload size={16} />}
					onClick={() => save()}
				>
					{t('backup.file.save')}
				</Button>

				<Button
					variant='secondary'
					size='small'
					disabled={restoring}
					startIcon={<MdFileUpload size={16} />}
					onClick={() => inputRef.current?.click()}
				>
					{t('backup.file.load')}
				</Button>

				<input
					ref={inputRef}
					type='file'
					accept='.gz,.json.gz,application/gzip'
					hidden
					onChange={onPick}
				/>
			</div>

			<Modal
				open={picked !== null}
				onOpenChange={next => !next && !restoring && setPicked(null)}
				size='sm'
				title={t('backup.file.restoreTitle')}
				description={t('backup.file.restoreHint', { name: picked?.name ?? '' })}
				footer={
					<>
						<Button variant='secondary' onClick={() => setPicked(null)} disabled={restoring}>
							{t('common.cancel')}
						</Button>

						<Button
							variant='primary'
							loading={restoring}
							startIcon={<MdFileUpload size={16} />}
							onClick={() => picked && restore(picked)}
						>
							{t('backup.restore')}
						</Button>
					</>
				}
			/>
		</section>
	)
}
