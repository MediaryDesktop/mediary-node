import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import type { TrackerCustomList } from '@entities/tracker'

import { manageListsModel } from '../../model/model'

import style from './ListOptionsMenu.module.scss'

export interface ListOptionsMenuProps {
	list: TrackerCustomList
}

export function ListOptionsMenu({ list }: ListOptionsMenuProps) {
	const { t } = useTranslation()
	const [renameRequested, deleteRequested] = useUnit([
		manageListsModel.renameRequested,
		manageListsModel.deleteRequested
	])

	const items: DropdownMenuItem[] = [
		{
			id: 'rename',
			label: t('lists.manage.rename'),
			icon: 'common/pencil',
			onSelect: () => renameRequested(list)
		},
		{
			id: 'delete',
			label: t('lists.manage.delete'),
			icon: 'common/trash',
			danger: true,
			onSelect: () => deleteRequested(list)
		}
	]

	return (
		<DropdownMenu
			items={items}
			trigger={
				<Button className={style.trigger} variant='glass' aria-label={t('lists.manage.options')}>
					<Icon name='common/more-vertical' size={18} />
				</Button>
			}
		/>
	)
}
