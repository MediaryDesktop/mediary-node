import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, SelectDropdown, Switch } from '@shared/ui'
import type { SelectDropdownOption } from '@shared/ui'

import { enumLabel } from '@entities/media'
import type {
	MediaSearchFormat,
	MediaSearchSeason,
	MediaSearchSort,
	MediaSearchStatus,
	MediaSearchType
} from '@entities/media'

import {
	EARLIEST_YEAR,
	SEARCH_FORMATS,
	SEARCH_SCORES,
	SEARCH_SEASONS,
	SEARCH_SORTS,
	SEARCH_STATUSES,
	SEARCH_TYPES,
	searchMediaModel
} from './model'
import styles from './SearchFilters.module.scss'

function yearOptions(): SelectDropdownOption[] {
	const latest = new Date().getFullYear() + 1
	const years: SelectDropdownOption[] = []

	for (let year = latest; year >= EARLIEST_YEAR; year -= 1) {
		years.push({ value: String(year), label: String(year) })
	}

	return years
}

export function SearchFilters() {
	const { t } = useTranslation()

	const [filters, options, patch, clear, activeFilters] = useUnit([
		searchMediaModel.$filters,
		searchMediaModel.$filterOptions,
		searchMediaModel.filtersPatched,
		searchMediaModel.filtersCleared,
		searchMediaModel.$activeFilterCount
	])

	const genres = useMemo<SelectDropdownOption[]>(
		() => (options?.genres ?? []).map(genre => ({ value: genre, label: genre })),
		[options]
	)

	const tags = useMemo<SelectDropdownOption[]>(
		() =>
			(options?.tags ?? [])
				.filter(tag => filters.adult || !tag.is_adult)
				.map(tag => ({ value: tag.name, label: tag.name, description: tag.category })),
		[options, filters.adult]
	)

	const formats = useMemo<SelectDropdownOption[]>(
		() =>
			SEARCH_FORMATS[filters.type].map(format => ({
				value: format,
				label: enumLabel(t, 'format', format) ?? format
			})),
		[filters.type, t]
	)

	const statuses = useMemo<SelectDropdownOption[]>(
		() =>
			SEARCH_STATUSES.map(status => ({
				value: status,
				label: enumLabel(t, 'status', status) ?? status
			})),
		[t]
	)

	const seasons = useMemo<SelectDropdownOption[]>(
		() =>
			SEARCH_SEASONS.map(season => ({
				value: season,
				label: enumLabel(t, 'season', season) ?? season
			})),
		[t]
	)

	const years = useMemo(() => yearOptions(), [])

	const scores = useMemo<SelectDropdownOption[]>(
		() =>
			SEARCH_SCORES.map(score => ({
				value: String(score),
				label: t('catalog.scoreAtLeast', { score })
			})),
		[t]
	)

	return (
		<div className={styles.panel}>
			<SelectDropdown
				value={filters.type}
				onChange={value => patch({ type: (value ?? 'anime') as MediaSearchType })}
				options={SEARCH_TYPES.map(type => ({ value: type, label: t(`catalog.type.${type}`) }))}
				startIcon={<Icon name='common/library' size={18} />}
			/>

			<SelectDropdown
				value={filters.sort}
				onChange={value => patch({ sort: (value ?? 'POPULARITY_DESC') as MediaSearchSort })}
				options={SEARCH_SORTS.map(sort => ({ value: sort, label: t(`catalog.sort.${sort}`) }))}
				startIcon={<Icon name='common/sort' size={18} />}
			/>

			<SelectDropdown
				mode='multiple'
				value={filters.genres}
				onChange={value => patch({ genres: value })}
				options={genres}
				searchable
				clearable
				placeholder={t('catalog.any.genres')}
				startIcon={<Icon name='common/sparkles' size={18} />}
			/>

			<SelectDropdown
				mode='multiple'
				value={filters.tags}
				onChange={value => patch({ tags: value })}
				options={tags}
				searchable
				clearable
				placeholder={t('catalog.any.tags')}
				startIcon={<Icon name='common/tag' size={18} />}
			/>

			<SelectDropdown
				mode='multiple'
				value={filters.formats}
				onChange={value => patch({ formats: value as MediaSearchFormat[] })}
				options={formats}
				clearable
				placeholder={t('catalog.any.formats')}
				startIcon={<Icon name='common/player' size={18} />}
			/>

			<SelectDropdown
				value={filters.season}
				onChange={value => patch({ season: (value as MediaSearchSeason | null) ?? null })}
				options={seasons}
				clearable
				placeholder={t('catalog.any.seasons')}
				startIcon={<Icon name='common/compass' size={18} />}
			/>

			<SelectDropdown
				value={filters.year === null ? null : String(filters.year)}
				onChange={value => patch({ year: value === null ? null : Number(value) })}
				options={years}
				searchable
				clearable
				placeholder={t('catalog.any.year')}
				startIcon={<Icon name='common/calendar' size={18} />}
			/>

			<SelectDropdown
				mode='multiple'
				value={filters.statuses}
				onChange={value => patch({ statuses: value as MediaSearchStatus[] })}
				options={statuses}
				clearable
				placeholder={t('catalog.any.statuses')}
				startIcon={<Icon name='common/signal' size={18} />}
			/>

			<SelectDropdown
				value={filters.minScore === null ? null : String(filters.minScore)}
				onChange={value => patch({ minScore: value === null ? null : Number(value) })}
				options={scores}
				clearable
				placeholder={t('catalog.any.score')}
				startIcon={<Icon name='common/star' size={18} />}
			/>

			<Switch
				checked={filters.adult}
				onChange={adult => patch({ adult })}
				label={t('catalog.adult')}
				className={styles.adult}
			/>

			<Button
				variant='ghost'
				size='small'
				iconOnly
				disabled={activeFilters === 0}
				onClick={() => clear()}
				aria-label={t('catalog.clear')}
				title={t('catalog.clear')}
				className={styles.clear}
			>
				<Icon name='common/trash' size={18} />
			</Button>
		</div>
	)
}
