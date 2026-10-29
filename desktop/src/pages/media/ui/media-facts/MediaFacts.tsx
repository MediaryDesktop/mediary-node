import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatCompact } from '@shared/lib'

import { enumLabel, formatMediaDate } from '@entities/media'
import type { MediaDetails } from '@entities/media'

import styles from './MediaFacts.module.scss'

export interface MediaFactsProps {
	media: MediaDetails
	mediaType: string
	locale: string
}

export function MediaFacts({ media, mediaType, locale }: MediaFactsProps) {
	const { t } = useTranslation()

	const facts: [string, ReactNode][] = []
	const addFact = (label: string, value: ReactNode) => {
		if (value !== null && value !== undefined && value !== '') {
			facts.push([label, value])
		}
	}

	addFact(t('media.fields.format'), enumLabel(t, 'format', media.format))
	addFact(t('media.fields.status'), enumLabel(t, 'status', media.status))

	if (mediaType === 'manga') {
		addFact(t('media.fields.chapters'), media.chapters)
		addFact(t('media.fields.volumes'), media.volumes)
	} else if (mediaType === 'book') {
		addFact(t('media.fields.authors'), media.authors?.join(', '))
		addFact(t('media.fields.pages'), media.pages)
	} else {
		addFact(t('media.fields.seasons'), media.seasons)
		addFact(t('media.fields.episodes'), media.episodes)
		addFact(
			t('media.fields.duration'),
			media.duration ? t('media.minutes', { count: media.duration }) : null
		)
	}

	addFact(t('media.fields.start'), formatMediaDate(media.start_date, locale))
	addFact(t('media.fields.end'), formatMediaDate(media.end_date, locale))
	addFact(t('media.fields.studios'), media.studios?.join(', '))
	addFact(t('media.fields.source'), enumLabel(t, 'origin', media.source))
	addFact(t('media.fields.country'), media.country_of_origin)
	addFact(
		t('media.stats.favourites'),
		media.favourites != null ? formatCompact(media.favourites, locale) : null
	)

	return (
		<>
			<dl className={styles.facts}>
				{facts.map(([label, value]) => (
					<div key={label} className={styles.fact}>
						<dt>{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>

			{media.synonyms && media.synonyms.length > 0 && (
				<div className={styles.synonyms}>
					<span>{t('media.fields.synonyms')}</span>
					{media.synonyms.map(synonym => (
						<p key={synonym}>{synonym}</p>
					))}
				</div>
			)}
		</>
	)
}
