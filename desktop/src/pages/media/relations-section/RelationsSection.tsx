import { useTranslation } from '@shared/i18n'

import { enumLabel } from '@entities/media'

import { RelatedCards } from './RelatedCards'
import type { RelatedTitle } from './RelatedCards'
import styles from './RelationsSection.module.scss'

export interface RelationsSectionProps {
	relations: RelatedTitle[]
}

export function RelationsSection({ relations }: RelationsSectionProps) {
	const { t } = useTranslation()

	if (relations.length === 0) {
		return null
	}

	return (
		<section className={styles.section}>
			<h2 className={styles.sectionTitle}>{t('media.sections.relations')}</h2>

			<RelatedCards
				titles={relations}
				aria-label={t('media.sections.relations')}
				cornerLabel={relation => enumLabel(t, 'relation', relation.relation_type) ?? undefined}
			/>
		</section>
	)
}
