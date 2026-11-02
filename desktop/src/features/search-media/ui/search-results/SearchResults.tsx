import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, PhaseTransition, Skeleton } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard } from '@entities/media'
import type { MediaSummary } from '@entities/media'
import { entryTracking, useTrackedEntries } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { searchMediaModel } from '../../model/model'
import { AddManuallyButton } from '../add-manually-button/AddManuallyButton'

import styles from './SearchResults.module.scss'

const SKELETON_COUNT = 12

export interface SearchResultsProps {
	renderMenu?: (media: MediaSummary, entry: TrackerEntry | null) => ReactNode
}

export function SearchResults({ renderMenu }: SearchResultsProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)

	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	const [items, loading, loadingMore, failed, setupNeeded, loadMoreFailed, hasNextPage, loadMore, retry] =
		useUnit([
			searchMediaModel.$items,
			searchMediaModel.$loadingFirstPage,
			searchMediaModel.$loadingMore,
			searchMediaModel.$failed,
			searchMediaModel.$setupNeeded,
			searchMediaModel.$loadMoreFailed,
			searchMediaModel.$hasNextPage,
			searchMediaModel.nextPageRequested,
			searchMediaModel.retried
		])

	const phase = loading
		? 'loading'
		: failed && setupNeeded !== null
			? 'setup'
			: failed
				? 'failed'
				: items.length === 0
					? 'empty'
					: 'results'

	const body = {
		loading: (
			<ul className={styles.grid}>
				{Array.from({ length: SKELETON_COUNT }, (_, index) => (
					<li key={index} className={styles.skeletonCard}>
						<Skeleton
							width='100%'
							height='auto'
							radius='14px'
							className={styles.skeletonPoster}
						/>
					</li>
				))}
			</ul>
		),

		setup: (
			<EmptyState
				title={setupNeeded || t('search.failed')}
				action={
					<Button
						size='small'
						onClick={() => navigate({ to: '/settings', search: { section: 'metadata' } })}
					>
						{t('tmdb.openSettings')}
					</Button>
				}
			/>
		),

		failed: (
			<EmptyState
				title={t('search.failed')}
				action={
					<Button size='small' onClick={() => retry()}>
						{t('search.retry')}
					</Button>
				}
			/>
		),

		empty: <EmptyState title={t('search.empty')} action={<AddManuallyButton />} />,

		results: (
			<div className={styles.results}>
				<ul className={styles.grid}>
					{items.map(media => {
						const entry = trackedByRef.get(media.media_ref)

						return (
							<li key={media.media_ref}>
								<MediaCard
									media={media}
									scoreBadge={media.average_score ?? undefined}
									tracking={entry ? entryTracking(entry, t) : null}
									menu={renderMenu?.(media, entry ?? null)}
									previewRef={media.media_ref}
									onOpen={() =>
										navigate({
											to: '/media/$mediaRef',
											params: { mediaRef: media.media_ref }
										})
									}
								/>
							</li>
						)
					})}
				</ul>

				{loadMoreFailed && <p className={styles.muted}>{t('search.loadMoreFailed')}</p>}

				{hasNextPage && (
					<div className={styles.more}>
						<Button
							variant='secondary'
							loading={loadingMore}
							onClick={() => (loadMoreFailed ? retry() : loadMore())}
						>
							{t('search.loadMore')}
						</Button>
					</div>
				)}
			</div>
		)
	}[phase]

	return <PhaseTransition phase={phase}>{body}</PhaseTransition>
}
