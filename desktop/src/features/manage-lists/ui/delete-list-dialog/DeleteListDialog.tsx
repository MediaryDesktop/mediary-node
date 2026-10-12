import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Modal } from '@shared/ui'

import { manageListsModel } from '../../model/model'

export function DeleteListDialog() {
	const { t } = useTranslation()

	const [list, open, pending, cancelled, confirmed] = useUnit([
		manageListsModel.$deleting,
		manageListsModel.$deleteOpen,
		manageListsModel.$deletePending,
		manageListsModel.deleteCancelled,
		manageListsModel.deleteConfirmed
	])

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && cancelled()}
			size='sm'
			title={t('lists.manage.deleteTitle', { name: list?.name ?? '' })}
			description={
				list?.provider === 'anilist'
					? t('lists.manage.deleteHintAniList')
					: t('lists.manage.deleteHintLocal')
			}
			footer={
				<>
					<Button variant='secondary' onClick={() => cancelled()} disabled={pending}>
						{t('common.cancel')}
					</Button>

					<Button variant='primary' onClick={() => confirmed()} loading={pending}>
						{t('lists.manage.delete')}
					</Button>
				</>
			}
		/>
	)
}
