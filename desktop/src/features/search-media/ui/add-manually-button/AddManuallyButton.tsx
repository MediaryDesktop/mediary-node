import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { searchMediaModel } from '../../model/model'

export function AddManuallyButton() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [title, filters] = useUnit([searchMediaModel.$title, searchMediaModel.$filters])

	return (
		<Button
			size='small'
			variant='secondary'
			startIcon={<Icon name='common/plus' size={16} />}
			onClick={() =>
				navigate({
					to: '/media/new',
					search: { type: filters.type, title: title.trim() || undefined }
				})
			}
		>
			{t('search.addManually')}
		</Button>
	)
}
