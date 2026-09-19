import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Skeleton } from '@shared/ui'

import { MediaCard } from '@entities/media'

import { searchMediaModel } from './model'
import styles from './SearchResults.module.scss'

const SKELETON_COUNT = 12

export function SearchResults() {
	const { t } = useTranslation()
	const navigate = useNavigate()

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
			<div className={styles.notice}>
				<p className={styles.muted}>{t('search.failed')}</p>
				<Button size='small' onClick={() => retry()}>
					{t('search.retry')}
				</Button>
			</div>
		)
	}

	if (items.length === 0) {
		return <p className={styles.muted}>{t('search.empty')}</p>
	}

	return (
		<div className={styles.results}>
			<ul className={styles.grid}>
				{items.map(media => (
					<li key={media.media_ref}>
						<MediaCard
							media={media}
							scoreBadge={media.average_score ?? undefined}
							previewRef={media.media_ref}
							onOpen={() =>
								navigate({ to: '/media/$mediaRef', params: { mediaRef: media.media_ref } })
							}
						/>
					</li>
				))}
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
