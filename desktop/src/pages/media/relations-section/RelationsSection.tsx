import { useTranslation } from '@shared/i18n'

import { enumLabel } from '@entities/media'

import { RelatedCards } from './RelatedCards'
import type { RelatedTitle } from './RelatedCards'

export interface RelationsSectionProps {
	relations: RelatedTitle[]
}

export function RelationsSection({ relations }: RelationsSectionProps) {
	const { t } = useTranslation()

	if (relations.length === 0) {
		return null
	}

	return (
		<RelatedCards
			titles={relations}
			title={t('media.sections.relations')}
			cornerLabel={relation => enumLabel(t, 'relation', relation.relation_type) ?? undefined}
		/>
	)
}
