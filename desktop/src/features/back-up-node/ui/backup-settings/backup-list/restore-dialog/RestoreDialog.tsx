import { useUnit } from 'effector-react'
import { MdRestore } from 'react-icons/md'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatDateTime, useUnitWatch } from '@shared/lib'
import { Button, Modal, toast } from '@shared/ui'

import type { SyncBackup } from '../../../../api/api'
import { BACKUP_TOAST_ID } from '../../../../config/toast'
import { restoreMutation } from '../../../../model/model'

export function RestoreDialog({ backup, onClose }: { backup: SyncBackup | null; onClose: () => void }) {
	const { t, i18n } = useTranslation()
	const [restore, restoring] = useUnit([restoreMutation.start, restoreMutation.$pending])

	useUnitWatch(restoreMutation.finished.success, () => {
		toast.success(t('backup.restored'), { id: BACKUP_TOAST_ID })
		onClose()
	})
	useUnitWatch(restoreMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('backup.restoreFailed')), { id: BACKUP_TOAST_ID })
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
						startIcon={<MdRestore size={16} />}
						onClick={() => backup && restore(backup.id)}
					>
						{t('backup.restore')}
					</Button>
				</>
			}
		/>
	)
}
