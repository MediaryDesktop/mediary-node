import type { KeyboardEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import styles from './SearchBar.module.scss'

export interface SearchCriteria {
	query: string
	season: string
	episode: string
}

export interface SearchBarProps {
	criteria: SearchCriteria
	onChange: (criteria: SearchCriteria) => void
	// A show's releases are named by season, and its episodes count within one.
	seasonal: boolean
	pending: boolean
	disabled: boolean
	onSearch: () => void
}

export function SearchBar({ criteria, onChange, seasonal, pending, disabled, onSearch }: SearchBarProps) {
	const { t } = useTranslation()

	const set = (field: keyof SearchCriteria) => (value: string) => onChange({ ...criteria, [field]: value })

	// The sheet is itself a form whose submit downloads; Enter in a search field
	// searches instead.
	const searchOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			onSearch()
		}
	}

	return (
		<div className={styles.bar}>
			<Input
				value={criteria.query}
				onChange={event => set('query')(event.target.value)}
				onKeyDown={searchOnEnter}
				placeholder={t('torrents.search.placeholder')}
				startIcon={<Icon name='common/search' size={16} />}
				className={styles.query}
				aria-label={t('torrents.search.placeholder')}
			/>
			{seasonal && (
				<Input
					type='number'
					min={1}
					value={criteria.season}
					onChange={event => set('season')(event.target.value)}
					onKeyDown={searchOnEnter}
					placeholder={t('torrents.search.season')}
					className={styles.episode}
					aria-label={t('torrents.search.season')}
				/>
			)}
			<Input
				type='number'
				min={0}
				value={criteria.episode}
				onChange={event => set('episode')(event.target.value)}
				onKeyDown={searchOnEnter}
				placeholder={t('torrents.search.episode')}
				className={styles.episode}
				aria-label={t('torrents.search.episode')}
			/>
			<Button loading={pending} disabled={disabled} onClick={onSearch}>
				{t('torrents.search.submit')}
			</Button>
		</div>
	)
}
