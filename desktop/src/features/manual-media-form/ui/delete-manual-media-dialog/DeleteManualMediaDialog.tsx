import { useTranslation } from '@shared/i18n'
import { Button, Modal } from '@shared/ui'

import { useManualMediaDeletion } from '../../lib/useManualMediaDeletion'

export interface DeleteManualMediaDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	id: string | undefined
	title: string
	onDeleted: () => void
}

export function DeleteManualMediaDialog({
	open,
	onOpenChange,
	id,
	title,
	onDeleted
}: DeleteManualMediaDialogProps) {
	const { t } = useTranslation()
	const { remove, deleting } = useManualMediaDeletion(onDeleted)

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			size='sm'
			title={t('manualMedia.delete.title', { title })}
			description={t('manualMedia.delete.hint')}
			footer={
				<>
					<Button variant='secondary' onClick={() => onOpenChange(false)} disabled={deleting}>
						{t('manualMedia.cancel')}
					</Button>

					<Button variant='primary' onClick={() => id && remove(id)} loading={deleting}>
						{t('manualMedia.delete.confirm')}
					</Button>
				</>
			}
		/>
	)
}
