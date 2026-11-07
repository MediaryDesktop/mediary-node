import { IoGitCompareOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'

import { RelatedCards } from './RelatedCards'
import type { RelatedTitle } from './RelatedCards'

export interface RecommendationsSectionProps {
	recommendations: RelatedTitle[]
	similar: RelatedTitle[]
}

export function RecommendationsSection({ recommendations, similar }: RecommendationsSectionProps) {
	const { t } = useTranslation()

	const both = recommendations.length > 0 && similar.length > 0

	return (
		<>
			{recommendations.length > 0 && (
				<RelatedCards
					titles={recommendations}
					title={t(both ? 'media.sections.recommended' : 'media.sections.recommendations')}
					icon='common/sparkles'
				/>
			)}

			{similar.length > 0 && (
				<RelatedCards
					titles={similar}
					title={t('media.sections.similar')}
					icon={<IoGitCompareOutline size={24} />}
				/>
			)}
		</>
	)
}
