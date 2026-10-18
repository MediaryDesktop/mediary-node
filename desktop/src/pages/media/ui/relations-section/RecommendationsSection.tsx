import { IoGitCompareOutline } from "react-icons/io5";

import { useTranslation } from '@shared/i18n'

import { RelatedCards } from './RelatedCards'
import type { RelatedTitle } from './RelatedCards'

export interface RecommendationsSectionProps {
	recommendations: RelatedTitle[]
	similar: RelatedTitle[]
}

// What to watch or read next: the source's recommendations and, where it has
// them (TMDB), titles alike in genre — each its own carousel, one under the
// other, so neither list crowds the other out.
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
				<RelatedCards titles={similar} title={t('media.sections.similar')} icon={<IoGitCompareOutline size={24} />} />
			)}
		</>
	)
}
