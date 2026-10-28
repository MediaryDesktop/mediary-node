import { useRouter } from '@tanstack/react-router'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, EmptyState, Icon, PageTransition, PhaseTransition } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'
import { mediaDetailsModel, mediaPreviewModel } from '@entities/media'
import { useTrackedEntry } from '@entities/tracker'

import { manualMediaModel } from '@features/manage-manual-media'

import styles from './MediaPage.module.scss'
import { MediaHeroSkeleton } from './ui/media-hero/MediaHeroSkeleton'
import { MediaView } from './ui/media-view/MediaView'

export interface MediaPageProps {
	mediaRef: string
}

export function MediaPage({ mediaRef }: MediaPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const { data, failedMediaRef, pending, requestDetails, connected, nodeReady } = useUnit({
		data: mediaDetailsModel.$data,
		failedMediaRef: mediaDetailsModel.$failedMediaRef,
		pending: mediaDetailsModel.$pending,
		requestDetails: mediaDetailsModel.detailsRequested,
		connected: aniListAccountModel.$connected,
		nodeReady: $nodeReady
	})

	const entry = useTrackedEntry(mediaRef, connected)

	useEffect(() => {
		window.scrollTo({ top: 0 })
	}, [mediaRef])

	useUnitWatch(manualMediaModel.deleted, deletedRef => {
		if (deletedRef === mediaRef) {
			router.history.back()
		}
	})

	// A reload of this page asks before the node is up, and that request fails.
	useEffect(() => {
		if (nodeReady) {
			requestDetails(mediaRef)
		}
	}, [mediaRef, requestDetails, nodeReady])

	// The card's hover preview has usually fetched the title already: open with
	// that and let the request below only confirm it.
	const preview = useStoreMap({
		store: mediaPreviewModel.$previews,
		keys: [mediaRef],
		fn: (previews, [ref]) => previews[ref] ?? null
	})
	const details =
		data?.media.media_ref === mediaRef ? data : preview ? { media: preview, sources: null } : null
	const failed = !details && failedMediaRef === mediaRef
	const phase = details ? 'details' : !failed ? 'loading' : entry ? 'offline' : 'failed'

	return (
		<PageTransition className={styles.root}>
			{/* Floating over the hero rather than above it: anything in flow here pushes
			    the banner down and uncovers the page behind its negative top inset. */}
			<div className={styles.topBar}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={() => router.history.back()}
				/>

				{phase === 'offline' && (
					<div className={styles.offline} role='status'>
						<Icon name='common/cloud' size={15} className={styles.offlineIcon} />
						<span className={styles.offlineText}>{t('media.offline')}</span>
						<Button
							variant='ghost'
							size='small'
							className={styles.offlineRetry}
							loading={pending}
							startIcon={<IoIosRefresh size={14} />}
							onClick={() => requestDetails(mediaRef)}
						>
							{t('media.retry')}
						</Button>
					</div>
				)}
			</div>

			<PhaseTransition phase={`${mediaRef}:${phase}`}>
				{phase === 'details' && details && (
					<MediaView
						mediaRef={mediaRef}
						media={details.media}
						sources={details.sources ?? []}
						entry={entry}
					/>
				)}

				{phase === 'loading' && <MediaHeroSkeleton />}

				{phase === 'offline' && (
					<MediaView mediaRef={mediaRef} media={null} sources={[]} entry={entry} />
				)}

				{phase === 'failed' && (
					<EmptyState
						className={styles.failure}
						title={t('media.failed')}
						description={t('media.failedHint')}
						action={
							<Button
								size='small'
								startIcon={<IoIosRefresh size={16} />}
								onClick={() => requestDetails(mediaRef)}
							>
								{t('media.retry')}
							</Button>
						}
					/>
				)}
			</PhaseTransition>
		</PageTransition>
	)
}
