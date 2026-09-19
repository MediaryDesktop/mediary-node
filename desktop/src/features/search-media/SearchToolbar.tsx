import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { searchMediaModel } from './model'
import styles from './SearchToolbar.module.scss'

export function SearchToolbar() {
	const { t } = useTranslation()

	const [title, filtersOpen, titleChanged, filtersToggled] = useUnit([
		searchMediaModel.$title,
		searchMediaModel.$filtersOpen,
		searchMediaModel.titleChanged,
		searchMediaModel.filtersToggled
	])

	return (
		<div className={styles.toolbar}>
			<Input
				className={styles.field}
				value={title}
				onChange={event => titleChanged(event.target.value)}
				placeholder={t('search.searchPlaceholder')}
				aria-label={t('search.searchLabel')}
				startIcon={<Icon name='common/search' size={18} />}
			/>

			<Button
				variant='secondary'
				onClick={() => filtersToggled()}
				aria-expanded={filtersOpen}
				startIcon={<Icon name='common/filter' size={18} />}
				className={styles.toggle}
			>
				{t('search.filters')}
			</Button>
		</div>
	)
}
