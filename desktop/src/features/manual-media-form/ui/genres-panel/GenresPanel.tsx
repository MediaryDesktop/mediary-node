import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon, Input } from '@shared/ui'

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
		<div className={styles.root}>
			<section className={styles.section}>
				<h3 className={styles.title}>
					{t('manualMedia.fields.genres')}

					{aiGenres && (
						<Badge tone='accent' size='sm'>
							{t('manualMedia.ai.filledBadge')}
						</Badge>
					)}
				</h3>

				<TagField
					value={genres}
					onChange={onGenresChange}
					placeholder={t('manualMedia.tagPlaceholder')}
					disabled={disabled}
				/>

				<div className={styles.suggestions}>
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
									className={clsx(styles.pill, genres.includes(genre) && styles.active)}
									aria-pressed={genres.includes(genre)}
									disabled={disabled}
									onClick={() => toggle(genre)}
								>
									{genre}
								</button>
							))}
						</div>
					)}
				</div>
			</section>

			<section className={styles.section}>
				<h3 className={styles.title}>{t('manualMedia.fields.score')}</h3>

				<div className={styles.score}>
					<Input
						className={styles.scoreInput}
						type='number'
						min={0}
						max={100}
						value={score ?? ''}
						onChange={event =>
							onScoreChange(event.target.value === '' ? undefined : Number(event.target.value))
						}
						placeholder='—'
						startIcon={<Icon name='common/star' size={16} className={styles.starIcon} />}
						aria-label={t('manualMedia.fields.score')}
						disabled={disabled}
					/>
					<span className={styles.scoreMax}>/ 100</span>
				</div>
			</section>
		</div>
	)
}
