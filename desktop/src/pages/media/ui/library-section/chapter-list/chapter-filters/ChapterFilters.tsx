import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, SegmentedControl } from '@shared/ui'

import { STATUS_FILTERS } from '../lib/chapters'
import type { SortOrder, StatusFilter } from '../lib/chapters'

import styles from './ChapterFilters.module.scss'

export interface ChapterFiltersProps {
	query: string
	onQueryChange: (query: string) => void
	status: StatusFilter
	onStatusChange: (status: StatusFilter) => void
	order: SortOrder
	onOrderChange: (order: SortOrder) => void
}

export function ChapterFilters({
	query,
	onQueryChange,
	status,
	onStatusChange,
	order,
	onOrderChange
}: ChapterFiltersProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.filters}>
			<Input
				className={styles.search}
				value={query}
				onChange={event => onQueryChange(event.target.value)}
				placeholder={t('mangaSources.chapters.search')}
				aria-label={t('mangaSources.chapters.search')}
				startIcon={<Icon name='common/search' size={16} />}
			/>

			<SegmentedControl<StatusFilter>
				label={t('mangaSources.chapters.status.label')}
				value={status}
				onValueChange={onStatusChange}
				items={STATUS_FILTERS.map(value => ({
					value,
					label: t(`mangaSources.chapters.status.${value}`)
				}))}
			/>

			<Button
				className={styles.sort}
				startIcon={<Icon name='common/sort' size={16} />}
				onClick={() => onOrderChange(order === 'newest' ? 'oldest' : 'newest')}
			>
				{t(`mangaSources.chapters.sort.${order}`)}
			</Button>
		</div>
	)
}
