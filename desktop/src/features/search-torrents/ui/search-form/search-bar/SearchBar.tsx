import type { KeyboardEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, Stepper } from '@shared/ui'

import type { SearchCriteria } from '../../../lib/useReleaseSearch'

import styles from './SearchBar.module.scss'

export interface SearchBarProps {
	criteria: SearchCriteria
	onChange: (criteria: SearchCriteria) => void
	seasonal: boolean
	pending: boolean
	disabled: boolean
	onSearch: () => void
}

export function SearchBar({ criteria, onChange, seasonal, pending, disabled, onSearch }: SearchBarProps) {
	const { t } = useTranslation()

	const set = (field: keyof SearchCriteria) => (value: string) => onChange({ ...criteria, [field]: value })

	const searchOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			onSearch()
		}
	}

	const season = Number(criteria.season) || 1
	const episode = Number(criteria.episode) || 0

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
				<div className={styles.step} role='group' aria-label={t('torrents.search.season')}>
					<Stepper
						value={
							<input
								type='number'
								min={1}
								className={styles.stepperInput}
								aria-label={t('torrents.search.season')}
								value={criteria.season}
								disabled={disabled}
								onChange={event => set('season')(event.target.value)}
								onKeyDown={searchOnEnter}
							/>
						}
						decrementDisabled={season <= 1}
						disabled={disabled}
						onDecrement={() => set('season')(String(season - 1))}
						onIncrement={() => set('season')(String(season + 1))}
					/>
				</div>
			)}
			<div className={styles.step} role='group' aria-label={t('torrents.search.episode')}>
				<Stepper
					value={
						<input
							type='number'
							min={0}
							className={styles.stepperInput}
							aria-label={t('torrents.search.episode')}
							value={criteria.episode}
							disabled={disabled}
							onChange={event => set('episode')(event.target.value)}
							onKeyDown={searchOnEnter}
						/>
					}
					decrementDisabled={episode <= 0}
					disabled={disabled}
					onDecrement={() => set('episode')(String(episode - 1))}
					onIncrement={() => set('episode')(String(episode + 1))}
				/>
			</div>
			<Button loading={pending} disabled={disabled} onClick={onSearch}>
				{t('torrents.search.submit')}
			</Button>
		</div>
	)
}
