import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon } from '@shared/ui'

import { QUICK_FILTERS } from '../../../lib/quick-filters'
import type { QuickFilter } from '../../../lib/quick-filters'
import { SORT_FIELDS } from '../../../lib/sort'
import type { ReleaseSortField } from '../../../lib/sort'
import type { ReleaseSortControl } from '../../../lib/useReleaseSort'

import styles from './ReleaseToolbar.module.scss'

export interface ReleaseToolbarProps {
	order: ReleaseSortControl
	filters: ReadonlySet<QuickFilter>
	onFilter: (filter: QuickFilter) => void
}

export function ReleaseToolbar({ order, filters, onFilter }: ReleaseToolbarProps) {
	const { t } = useTranslation()
	const { sort } = order

	const fieldLabel = (field: ReleaseSortField | null) =>
		t(`torrents.search.picker.sort.${field ?? 'relevance'}`)

	return (
		<div className={styles.toolbar} role='group' aria-label={t('torrents.search.picker.quick.label')}>
			{QUICK_FILTERS.map(filter => {
				const on = filters.has(filter)

				return (
					<button
						key={filter}
						type='button'
						aria-pressed={on}
						className={clsx(styles.chip, on && styles.on)}
						onClick={() => onFilter(filter)}
					>
						{on && <Icon name='common/check' size={14} />}
						{t(`torrents.search.picker.quick.${filter}`)}
					</button>
				)
			})}

			<span className={styles.spacer} />

			<DropdownMenu
				align='end'
				items={[null, ...SORT_FIELDS].map(field => ({
					id: field ?? 'relevance',
					label: fieldLabel(field),
					checked: sort.field === field,
					onSelect: () => order.pick(field)
				}))}
				trigger={
					<Button
						variant='secondary'
						size='small'
						endIcon={<Icon name='common/chevron-down' size={14} />}
						aria-label={t('torrents.search.picker.sort.label')}
					>
						<span className={styles.sortBy}>{t('torrents.search.picker.sortBy')}</span>
						{fieldLabel(sort.field)}
					</Button>
				}
			/>
			<Button
				variant='secondary'
				size='small'
				iconOnly
				disabled={!sort.field}
				aria-label={t(`torrents.search.picker.direction.${sort.direction}`)}
				title={t(`torrents.search.picker.direction.${sort.direction}`)}
				onClick={order.flip}
				startIcon={
					<Icon
						name='common/sort'
						size={16}
						className={clsx(styles.direction, sort.direction === 'asc' && styles.asc)}
					/>
				}
			/>
		</div>
	)
}
