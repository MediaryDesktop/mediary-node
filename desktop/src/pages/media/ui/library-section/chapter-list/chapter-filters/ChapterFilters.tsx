import clsx from 'clsx'
import type { ReactNode } from 'react'
import { CiBoxList } from 'react-icons/ci'
import { FaEye } from 'react-icons/fa'
import { MdBookmarkAdded } from 'react-icons/md'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, RippleButton } from '@shared/ui'

import { STATUS_FILTERS } from '../lib/chapters'
import type { SortOrder, StatusFilter } from '../lib/chapters'

import styles from './ChapterFilters.module.scss'

const STATUS_ICONS: Record<StatusFilter, ReactNode> = {
	all: <CiBoxList size={18} />,
	saved: <MdBookmarkAdded size={18} />,
	read: <Icon name='common/check' size={18} />,
	unread: <FaEye size={18} />
}

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

			<div className={styles.status} role='group' aria-label={t('mangaSources.chapters.status.label')}>
				{STATUS_FILTERS.map(value => (
					<RippleButton
						key={value}
						className={clsx(styles.chip, value === status && styles.active)}
						aria-pressed={value === status}
						onClick={() => onStatusChange(value)}
					>
						{STATUS_ICONS[value]}
						{t(`mangaSources.chapters.status.${value}`)}
					</RippleButton>
				))}
			</div>

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
