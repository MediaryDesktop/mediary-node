import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { mediaFilterOptionsQuery } from '@entities/media'

import type { ManualMediaType } from '../../lib/draft'
import { Field } from '../field/Field'
import { TagField } from '../tag-field/TagField'

import styles from './GenresPanel.module.scss'

export interface GenresPanelProps {
	mediaType: ManualMediaType
	genres: string[]
	onGenresChange: (next: string[]) => void
	aiGenres?: boolean
	disabled?: boolean
}

export function GenresPanel({ mediaType, genres, onGenresChange, aiGenres, disabled }: GenresPanelProps) {
	const { t } = useTranslation()
	const [query, setQuery] = useState('')

	const [options, start] = useUnit([mediaFilterOptionsQuery.$data, mediaFilterOptionsQuery.start])

	useEffect(() => {
		start(mediaType)
	}, [mediaType, start])

	const catalog = options?.options.genres ?? []
	const needle = query.trim().toLowerCase()
	const visible = needle === '' ? catalog : catalog.filter(genre => genre.toLowerCase().includes(needle))

	const toggle = (genre: string) =>
		onGenresChange(genres.includes(genre) ? genres.filter(item => item !== genre) : [...genres, genre])

	return (
		<Field as='div' label={t('manualMedia.fields.genres')} ai={aiGenres}>
			<div className={styles.genres}>
				<TagField
					value={genres}
					onChange={onGenresChange}
					onDraftChange={setQuery}
					placeholder={t('manualMedia.tagPlaceholder')}
					disabled={disabled}
				/>

				{catalog.length > 0 && (
					<div className={styles.pills}>
						{visible.length > 0 ? (
							visible.map(genre => (
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
							))
						) : (
							<span className={styles.noMatch}>{t('manualMedia.sections.genresNoMatch')}</span>
						)}
					</div>
				)}
			</div>
		</Field>
	)
}
