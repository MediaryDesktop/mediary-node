import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, ProgressBar } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { FeaturedBanner, fetchMediaDetailsFx } from '@entities/media'
import type { FeaturedMedia, MediaDate } from '@entities/media'
import { formatProgress } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { usePlayFile, useUpNextLabel } from '@features/continue-watching'
import type { ContinueWatchingState } from '@features/continue-watching'

import styles from './HomeBanner.module.scss'

// As many as Discover's banner goes through.
const MAX_SLIDES = 8

interface Slide extends FeaturedMedia {
	entry: TrackerEntry
}

interface Details {
	description?: string
	start_date?: MediaDate
}

export interface HomeBannerProps {
	entries: TrackerEntry[]
	watching: ContinueWatchingState
	onOpen: (mediaRef: string) => void
}

// The anime the user is in the middle of, one at a time, with how far they got
// and — when the library has the next episode — a button that plays it.
export function HomeBanner({ entries, watching, onOpen }: HomeBannerProps) {
	const { t } = useTranslation()
	const { play, starting } = usePlayFile()
	const labelOf = useUpNextLabel()

	const current = useMemo(
		() =>
			entries
				.filter(entry => entry.media_type === 'anime' && entry.status === 'CURRENT')
				.filter(entry => entry.media.banner_image ?? entry.media.cover_image)
				.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
				.slice(0, MAX_SLIDES),
		[entries]
	)

	const details = useSynopses(current.map(entry => entry.media_ref))

	const slides = useMemo(
		(): Slide[] =>
			current.map(entry => ({
				entry,
				media_ref: entry.media_ref,
				media_type: entry.media_type,
				title: entry.media.title,
				banner_image: entry.media.banner_image,
				cover_image: entry.media.cover_image,
				cover_color: entry.media.cover_color,
				season_year: entry.media.season_year,
				format: entry.media.format,
				average_score: entry.media.average_score,
				genres: entry.media.genres,
				...details[entry.media_ref]
			})),
		[current, details]
	)

	if (slides.length === 0) {
		return null
	}

	return (
		<FeaturedBanner
			className={styles.banner}
			items={slides}
			loading={false}
			onOpen={slide => onOpen(slide.media_ref)}
			label={t('home.banner.label')}
			openLabel={t('home.banner.open')}
			extra={({ entry }) => {
				const next = watching.byRef.get(entry.media_ref)

				return (
					next && (
						<Button
							variant='primary'
							disabled={starting}
							startIcon={<Icon name='common/play' size={16} />}
							onClick={() => play(next.file.id)}
						>
							{t('home.banner.continue', { episode: labelOf(next) })}
						</Button>
					)
				)
			}}
			corner={({ entry }) => (
				<div className={styles.progress}>
					<span className={styles.progressLabel}>
						{t('home.banner.progress')}
						<strong>{formatProgress(entry.progress, entry.media.episodes)}</strong>
					</span>
					<ProgressBar
						value={entry.progress}
						max={entry.media.episodes}
						label={t('home.banner.progress')}
						className={styles.progressBar}
					/>
				</div>
			)}
		/>
	)
}

// The synopsis is not part of a list entry; the title's details have it, and the
// node keeps them cached, so the banner asks once per title while the page is open.
function useSynopses(refs: string[]): Record<string, Details> {
	const nodeReady = useUnit($nodeReady)
	const [details, setDetails] = useState<Record<string, Details>>({})
	const key = refs.join('|')

	useEffect(() => {
		if (!nodeReady) {
			return
		}

		let cancelled = false
		const missing = key.split('|').filter(ref => ref && !(ref in details))

		for (const ref of missing) {
			fetchMediaDetailsFx(ref)
				.then(({ media }) => {
					if (!cancelled) {
						setDetails(state => ({
							...state,
							[ref]: { description: media.description, start_date: media.start_date }
						}))
					}
				})
				.catch(() => {
					if (!cancelled) {
						setDetails(state => ({ ...state, [ref]: {} }))
					}
				})
		}

		return () => {
			cancelled = true
		}
		// Only a change of titles asks again; answers landing must not re-run it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, nodeReady])

	return details
}
