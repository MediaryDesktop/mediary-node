import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, SelectDropdown, SelectionGroup, Stepper } from '@shared/ui'

import type { ReleaseKind } from '../../../lib/releases'
import { ALL_SOURCES } from '../../../lib/sources'
import type { ReleaseSourceOption } from '../../../lib/sources'
import type { SearchCriteria } from '../../../lib/useReleaseSearch'

import styles from './ReleaseFinder.module.scss'

export interface ReleaseFinderProps {
	kind: ReleaseKind
	onKind: (kind: ReleaseKind) => void
	criteria: SearchCriteria
	onCriteria: (criteria: SearchCriteria) => void
	onSearch: (criteria: SearchCriteria) => void
	sources: ReleaseSourceOption[]
	source: string
	onSource: (source: string) => void
	seasonal: boolean
	episodic: boolean
	pending: boolean
	disabled: boolean
}

export function ReleaseFinder({
	kind,
	onKind,
	criteria,
	onCriteria,
	onSearch,
	sources,
	source,
	onSource,
	seasonal,
	episodic,
	pending,
	disabled
}: ReleaseFinderProps) {
	const { t } = useTranslation()

	const season = Number(criteria.season) || 1
	const episode = Number(criteria.episode) || 1

	return (
		<section className={styles.finder}>
			<SelectionGroup
				stretch
				options={[
					{ value: 'all', label: t('torrents.search.kind.all') },
					{ value: 'episodes', label: t('torrents.search.kind.episodes') },
					{ value: 'batches', label: t('torrents.search.kind.batches') }
				]}
				value={kind}
				onValueChange={onKind}
				label={t('torrents.search.kind.label')}
			/>

			<form
				className={styles.query}
				onSubmit={event => {
					event.preventDefault()
					onSearch(criteria)
				}}
			>
				<Input
					className={styles.input}
					value={criteria.query}
					onChange={event => onCriteria({ ...criteria, query: event.target.value })}
					placeholder={t('torrents.search.picker.queryPlaceholder')}
					aria-label={t('torrents.search.picker.queryPlaceholder')}
					startIcon={<Icon name='common/search' size={16} />}
					disabled={disabled}
				/>
				<Button type='submit' variant='primary' size='small' loading={pending} disabled={disabled}>
					{t('torrents.search.submit')}
				</Button>
			</form>

			<div className={styles.fields}>
				<div className={styles.source}>
					<span className={styles.label}>{t('torrents.search.picker.source')}</span>
					<SelectDropdown
						options={[
							{ value: ALL_SOURCES, label: t('torrents.search.picker.allSources') },
							...sources.map(option => ({ value: option.key, label: option.name }))
						]}
						value={source}
						onChange={value => onSource(value ?? ALL_SOURCES)}
						disabled={sources.length === 0}
					/>
				</div>

				{seasonal && (
					<div className={styles.step} role='group' aria-label={t('torrents.search.season')}>
						<span className={styles.label}>{t('torrents.search.season')}</span>
						<Stepper
							value={season}
							decrementDisabled={season <= 1}
							disabled={disabled}
							onDecrement={() => onSearch({ ...criteria, season: String(season - 1) })}
							onIncrement={() => onSearch({ ...criteria, season: String(season + 1) })}
						/>
					</div>
				)}

				{episodic && (
					<div className={styles.step} role='group' aria-label={t('torrents.search.episode')}>
						<span className={styles.label}>{t('torrents.search.episode')}</span>
						<Stepper
							value={episode}
							decrementDisabled={episode <= 1}
							disabled={disabled}
							onDecrement={() => onSearch({ ...criteria, episode: String(episode - 1) })}
							onIncrement={() => onSearch({ ...criteria, episode: String(episode + 1) })}
						/>
					</div>
				)}
			</div>
		</section>
	)
}
