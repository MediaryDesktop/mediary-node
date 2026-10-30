import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Input } from '@shared/ui'

import { mediaFilterOptionsQuery } from '@entities/media'

import type { ManualMediaType } from '../../lib/draft'
import { TagField } from '../tag-field/TagField'

import styles from './GenresPanel.module.scss'

export interface GenresPanelProps {
	mediaType: ManualMediaType
	genres: string[]
	onGenresChange: (next: string[]) => void
	score?: number
	onScoreChange: (score: number | undefined) => void
	aiGenres?: boolean
	disabled?: boolean
}

export function GenresPanel({
	mediaType,
	genres,
	onGenresChange,
	score,
	onScoreChange,
	aiGenres,
	disabled
}: GenresPanelProps) {
	const { t } = useTranslation()
	const [query, setQuery] = useState('')

	const [options, start] = useUnit([mediaFilterOptionsQuery.$data, mediaFilterOptionsQuery.start])

	useEffect(() => {
		start(mediaType)
	}, [mediaType, start])

	const suggestions = (options?.options.genres ?? []).filter(genre =>
		genre.toLowerCase().includes(query.trim().toLowerCase())
	)

	const toggle = (genre: string) =>
		onGenresChange(genres.includes(genre) ? genres.filter(item => item !== genre) : [...genres, genre])

	return (
		<div className={styles.stack}>
			<div className={styles.card}>
				<h3 className={styles.title}>
					{t('manualMedia.sections.genres')}
					{aiGenres && <Icon name='common/wand-sparkles' size={12} className={styles.aiDot} />}
				</h3>

				<Input
					value={query}
					onChange={event => setQuery(event.target.value)}
					placeholder={t('manualMedia.genreSearchPlaceholder')}
					startIcon={<Icon name='common/search' size={16} />}
					disabled={disabled}
				/>

				{suggestions.length > 0 && (
					<div className={styles.pills}>
						{suggestions.slice(0, 18).map(genre => (
							<button
								key={genre}
								type='button'
								className={genres.includes(genre) ? styles.pillActive : styles.pill}
								disabled={disabled}
								onClick={() => toggle(genre)}
							>
								{genre}
							</button>
						))}
					</div>
				)}

				<TagField
					value={genres}
					onChange={onGenresChange}
					placeholder={t('manualMedia.tagPlaceholder')}
					disabled={disabled}
				/>
			</div>

			<div className={styles.card}>
				<h3 className={styles.title}>{t('manualMedia.fields.score')}</h3>

				<div className={styles.score}>
					<Icon name='common/star' size={18} className={styles.starIcon} />
					<Input
						type='number'
						min={0}
						max={100}
						value={score ?? ''}
						onChange={event =>
							onScoreChange(event.target.value === '' ? undefined : Number(event.target.value))
						}
						disabled={disabled}
					/>
					<span className={styles.scoreMax}>/100</span>
				</div>
			</div>
		</div>
	)
}
