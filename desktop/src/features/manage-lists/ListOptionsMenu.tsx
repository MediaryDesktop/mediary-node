import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import type { TrackerCustomList } from '@entities/tracker'

import styles from './ListOptionsMenu.module.scss'
import { manageListsModel } from './model'

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
			onSelect: () => deleteRequested(list.id)
		}
	]

	return (
		<DropdownMenu
			items={items}
			trigger={
				<button type='button' className={styles.trigger} aria-label={t('lists.manage.options')}>
					<Icon name='common/more-vertical' size={18} />
				</button>
			}
		/>
	)
}
