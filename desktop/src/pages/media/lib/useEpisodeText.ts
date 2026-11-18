import { useTranslation } from '@shared/i18n'

import type { LibraryFile } from '@entities/library-item'
import { episodeTitle } from '@entities/media'
import type { MediaEpisode } from '@entities/media'

import { fileEpisodeLabel } from '@features/continue-watching'

export function useEpisodeText() {
	const { t, i18n } = useTranslation()

	const label = (file: LibraryFile, seasonal = false): string => fileEpisodeLabel(t, file, seasonal)

	const name = (episode: MediaEpisode | undefined): string | null =>
		episode ? episodeTitle(episode, i18n.language) : null

	const minutes = (file: LibraryFile | null, episode: MediaEpisode | undefined): string | null => {
		const value = file?.duration_seconds ? file.duration_seconds / 60 : episode?.runtime_minutes

		return value ? String(t('media.library.minutes', { count: Math.max(1, Math.round(value)) })) : null
	}

	const aired = (episode: MediaEpisode | undefined): string | null => {
		if (!episode?.air_date) {
			return null
		}

		const date = new Date(`${episode.air_date}T00:00:00Z`)
		if (Number.isNaN(date.getTime())) {
			return null
		}

		const formatted = new Intl.DateTimeFormat(i18n.language, {
			dateStyle: 'medium',
			timeZone: 'UTC'
		}).format(date)

		return String(t('media.library.aired', { date: formatted }))
	}

	return { label, name, minutes, aired }
}
