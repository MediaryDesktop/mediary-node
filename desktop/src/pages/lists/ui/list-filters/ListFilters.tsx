import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, SelectDropdown } from '@shared/ui'

import { enumLabel } from '@entities/media'
import { isTrackerStatus, TRACKER_STATUSES } from '@entities/tracker'
import type { TrackerMediaType } from '@entities/tracker'

import { ANY, ENTRY_SORTS, hasActiveFilters, INITIAL_ENTRY_FILTERS } from '../../lib/entry-filters'
import type { EntryFilters, EntrySort } from '../../lib/entry-filters'

import styles from './ListFilters.module.scss'

export interface ListFiltersProps {
	filters: EntryFilters
	formats: string[]
	genres: string[]
	mediaType: TrackerMediaType
	onChange: (filters: EntryFilters) => void
}

export function ListFilters({ filters, formats, genres, mediaType, onChange }: ListFiltersProps) {
	const { t } = useTranslation()

	const patch = (part: Partial<EntryFilters>) => onChange({ ...filters, ...part })

	return (
		<div className={styles.filters}>
			<Input
				value={filters.title}
				onChange={event => patch({ title: event.target.value })}
				placeholder={t('lists.filters.search')}
				startIcon={<Icon name='common/search' size={18} />}
				className={styles.search}
			/>

			<SelectDropdown
				value={filters.status}
				onChange={next => patch({ status: next && isTrackerStatus(next) ? next : ANY })}
				options={[
					{ value: ANY, label: t('lists.filters.anyStatus') },
					...TRACKER_STATUSES.map(status => ({
						value: status,
						label: t(`lists.status.${mediaType}.${status}`)
					}))
				]}
				className={styles.control}
			/>

			{formats.length > 1 && (
				<SelectDropdown
					value={filters.format}
					onChange={next => patch({ format: next ?? ANY })}
					options={[
						{ value: ANY, label: t('lists.filters.anyFormat') },
						...formats.map(format => ({
							value: format,
							label: enumLabel(t, 'format', format) ?? format
						}))
					]}
					className={styles.control}
				/>
			)}

			{genres.length > 1 && (
				<SelectDropdown
					value={filters.genre}
					onChange={next => patch({ genre: next ?? ANY })}
					options={[
						{ value: ANY, label: t('lists.filters.anyGenre') },
						...genres.map(genre => ({ value: genre, label: genre }))
					]}
					className={styles.control}
				/>
			)}

			<SelectDropdown
				value={filters.sort}
				onChange={next => patch({ sort: (next as EntrySort) ?? 'default' })}
				options={ENTRY_SORTS.map(sort => ({
					value: sort,
					label: t(`lists.filters.sort.${sort}`)
				}))}
				startIcon={<Icon name='common/sort' size={16} />}
				className={styles.sort}
			/>

			<Button
				variant='primary'
				iconOnly
				disabled={!hasActiveFilters(filters)}
				aria-label={t('lists.filters.reset')}
				onClick={() => onChange(INITIAL_ENTRY_FILTERS)}
				className={styles.reset}
			>
				<IoIosRefresh size={16} />
			</Button>
		</div>
	)
}
