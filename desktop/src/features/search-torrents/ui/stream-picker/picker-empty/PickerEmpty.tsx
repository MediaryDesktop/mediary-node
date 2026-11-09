import { useTranslation } from '@shared/i18n'
import { Button, EmptyState } from '@shared/ui'

import type { EmptyReason } from '../../../lib/sources'

export interface PickerEmptyProps {
	reason: EmptyReason
	found: number
	episode: string
	queries: string[]
	onShowAll: () => void
}

export function PickerEmpty({ reason, found, episode, queries, onShowAll }: PickerEmptyProps) {
	const { t } = useTranslation()

	if (reason === 'episode') {
		return (
			<EmptyState
				title={t('torrents.search.picker.noEpisode', { episode })}
				description={t('torrents.search.picker.noEpisodeHint', { count: found })}
				action={<Button onClick={onShowAll}>{t('torrents.search.picker.showAll')}</Button>}
			/>
		)
	}

	return (
		<EmptyState
			title={t('torrents.search.empty')}
			description={
				reason === 'nothing' && queries.length > 0
					? t('torrents.search.queries', { queries: queries.join(' · ') })
					: t('torrents.search.emptyHint')
			}
		/>
	)
}
