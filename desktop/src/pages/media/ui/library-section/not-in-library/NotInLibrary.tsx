import clsx from 'clsx'
import { IoLibraryOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { Skeleton } from '@shared/ui'

import type { MediaEpisode } from '@entities/media'

import { EpisodeImage } from '@features/continue-watching'
import type { EpisodeIndex } from '@features/continue-watching'

import { EpisodeAside } from '../episode-row/EpisodeAside'
import rowStyles from '../episode-row/EpisodeRow.module.scss'
import { EpisodeText } from '../episode-row/EpisodeText'
import sectionStyles from '../EpisodeSection.module.scss'
import { useEpisodeText } from '../lib/useEpisodeText'

const MAX_EPISODE_PLACEHOLDERS = 28

interface Placeholder {
	key: string
	label: string
	episode: MediaEpisode | undefined
}

export interface NotInLibraryProps {
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	meta: EpisodeIndex
}

export function NotInLibrary({ cover, coverColor, banner, total, meta }: NotInLibraryProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()

	if (!total) {
		return null
	}

	const placeholders: Placeholder[] = meta.seasonal
		? meta.list.slice(0, MAX_EPISODE_PLACEHOLDERS).map(episode => ({
				key: `${episode.season}:${episode.number}`,
				label: String(
					t('media.library.seasonEpisode', { season: episode.season ?? 1, number: episode.number })
				),
				episode
			}))
		: Array.from({ length: Math.min(total, MAX_EPISODE_PLACEHOLDERS) }, (_, index) => ({
				key: String(index + 1),
				label: String(t('media.library.episode', { number: index + 1 })),
				episode: meta.byKey.get(`:${index + 1}`)
			}))

	const shown = placeholders.length
	const known = meta.list.some(episode => episode.title || episode.overview || episode.image)

	return (
		<section className={sectionStyles.section}>
			<h2 className={sectionStyles.libraryTitle}>
				<IoLibraryOutline size={20} />
				{t('media.library.notInLibrary')}
			</h2>

			<p className={sectionStyles.libraryText}>{t('media.library.episodesNotInLibrary')}</p>
			{!known && (
				<p className={sectionStyles.libraryNotice}>{t('media.library.metadataUnavailable')}</p>
			)}

			<ul className={rowStyles.episodes}>
				{placeholders.map(({ key, label, episode }) => (
					<li key={key} className={rowStyles.episode}>
						<span
							className={clsx(
								rowStyles.episodeImage,
								!episode?.image && rowStyles.placeholderImage
							)}
							style={{ backgroundColor: coverColor ?? undefined }}
						>
							<EpisodeImage sources={[episode?.image, banner ?? cover]} />
						</span>

						{known ? (
							<EpisodeText
								label={label}
								name={text.name(episode)}
								duration={text.minutes(null, episode)}
								overview={episode?.overview ?? null}
							/>
						) : (
							<span className={rowStyles.episodeContent}>
								<span className={rowStyles.episodeHeader}>
									<span className={rowStyles.episodeLabel}>{label}</span>
								</span>
								<span className={rowStyles.episodePlaceholder}>
									<Skeleton width='70%' height='0.75rem' />
									<Skeleton width='45%' height='0.75rem' />
								</span>
							</span>
						)}

						<EpisodeAside episode={episode} watched={false} />
					</li>
				))}
			</ul>

			{(meta.seasonal ? meta.list.length : total) > shown && (
				<p className={sectionStyles.libraryText}>{t('media.library.andMore')}</p>
			)}
		</section>
	)
}
