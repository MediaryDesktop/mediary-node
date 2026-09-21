import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'

import { enumLabel, MediaCard } from '@entities/media'
import type { MediaDetails } from '@entities/media'

import styles from './RelationsSection.module.scss'

type Relation = NonNullable<MediaDetails['relations']>[number]

export interface RelationsSectionProps {
	relations: Relation[]
}

export function RelationsSection({ relations }: RelationsSectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	if (relations.length === 0) {
		return null
	}

	return (
		<section className={styles.section}>
			<h2 className={styles.sectionTitle}>{t('media.sections.relations')}</h2>

			<ul className={styles.relations}>
				{relations.map(relation => (
					<li key={`${relation.relation_type}-${relation.media_ref}`}>
						<MediaCard
							media={relation}
							cornerLabel={enumLabel(t, 'relation', relation.relation_type)}
							previewRef={relation.media_ref}
							onOpen={() =>
								navigate({
									to: '/media/$mediaRef',
									params: { mediaRef: relation.media_ref }
								})
							}
						/>
					</li>
				))}
			</ul>
		</section>
	)
}
