import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { SegmentedControl } from '@shared/ui'

import { RelatedCards } from './RelatedCards'
import type { RelatedTitle } from './RelatedCards'
import styles from './RelationsSection.module.scss'

type Tab = 'recommended' | 'similar'

export interface RecommendationsSectionProps {
	recommendations: RelatedTitle[]
	similar: RelatedTitle[]
}

// What to watch or read next: the source's recommendations and, where it has
// them (TMDB), titles alike in genre. Tabs appear only when both lists do.
export function RecommendationsSection({ recommendations, similar }: RecommendationsSectionProps) {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>('recommended')

	if (recommendations.length === 0 && similar.length === 0) {
		return null
	}

	const both = recommendations.length > 0 && similar.length > 0
	const shown = both ? tab : recommendations.length > 0 ? 'recommended' : 'similar'

	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>
				<h2 className={styles.sectionTitle}>
					{shown === 'similar' && !both
						? t('media.sections.similar')
						: t('media.sections.recommendations')}
				</h2>

				{both && (
					<SegmentedControl
						items={[
							{ value: 'recommended', label: t('media.sections.recommended') },
							{ value: 'similar', label: t('media.sections.similar') }
						]}
						value={tab}
						onValueChange={setTab}
					/>
				)}
			</div>

			<RelatedCards
				titles={shown === 'recommended' ? recommendations : similar}
				aria-label={t(
					shown === 'recommended' ? 'media.sections.recommended' : 'media.sections.similar'
				)}
			/>
		</section>
	)
}
