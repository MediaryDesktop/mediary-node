import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Modal } from '@shared/ui'

import { manualMediaModel } from '../../model/model'

export function DeleteManualMediaDialog() {
	const { t } = useTranslation()

	const [target, open, pending, cancelled, confirmed] = useUnit([
		manualMediaModel.$deleting,
		manualMediaModel.$deleteOpen,
		manualMediaModel.$deletePending,
		manualMediaModel.deleteCancelled,
		manualMediaModel.deleteConfirmed
	])

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && cancelled()}
			size='sm'
			title={t('manualMedia.deleteTitle', { title: target?.title ?? '' })}
			description={t('manualMedia.deleteHint')}
			footer={
				<>
					<Button variant='secondary' onClick={() => cancelled()} disabled={pending}>
						{t('common.cancel')}
					</Button>

					<Button variant='primary' onClick={() => confirmed()} loading={pending}>
						{t('manualMedia.delete')}
					</Button>
				</>
			}
		/>
	)
}
