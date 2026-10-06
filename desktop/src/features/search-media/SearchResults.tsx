import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Skeleton } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard } from '@entities/media'
import type { MediaSummary } from '@entities/media'
import { entryTracking, useTrackedEntries } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { searchMediaModel } from './model'
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

	const [items, loading, loadingMore, failed, loadMoreFailed, hasNextPage, loadMore, retry] = useUnit([
		searchMediaModel.$items,
		searchMediaModel.$loadingFirstPage,
		searchMediaModel.$loadingMore,
		searchMediaModel.$failed,
		searchMediaModel.$loadMoreFailed,
		searchMediaModel.$hasNextPage,
		searchMediaModel.nextPageRequested,
		searchMediaModel.retried
	])

	if (loading) {
		return (
			<ul className={styles.grid}>
				{Array.from({ length: SKELETON_COUNT }, (_, index) => (
					<li key={index} className={styles.skeletonCard}>
						<Skeleton height='100%' radius='14px' className={styles.skeletonPoster} />
					</li>
				))}
			</ul>
		)
	}

	if (failed) {
		return (
			<EmptyState
				title={t('search.failed')}
				action={
					<Button size='small' onClick={() => retry()}>
						{t('search.retry')}
					</Button>
				}
			/>
		)
	}

	if (items.length === 0) {
		return <EmptyState title={t('search.empty')} />
	}

	return (
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
}
