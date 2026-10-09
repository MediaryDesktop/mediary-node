import { useRouter } from '@tanstack/react-router'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Icon, PageTransition, PhaseTransition } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'
import { mediaDetailsModel, mediaPreviewModel } from '@entities/media'
import { useTrackedEntry } from '@entities/tracker'

import { MediaHeroSkeleton } from './media-hero/MediaHeroSkeleton'
import { MediaView } from './media-view/MediaView'
import styles from './MediaPage.module.scss'

export interface MediaPageProps {
	mediaRef: string
}

export function MediaPage({ mediaRef }: MediaPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const { data, failedMediaRef, requestDetails, connected, nodeReady } = useUnit({
		data: mediaDetailsModel.$data,
		failedMediaRef: mediaDetailsModel.$failedMediaRef,
		requestDetails: mediaDetailsModel.detailsRequested,
		connected: aniListAccountModel.$connected,
		nodeReady: $nodeReady
	})

	const entry = useTrackedEntry(mediaRef, connected)

	useEffect(() => {
		window.scrollTo({ top: 0 })
	}, [mediaRef])

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
			<Button
				variant='ghost'
				size='small'
				className={styles.back}
				startIcon={<Icon name='common/arrow-left' size={18} />}
				onClick={() => router.history.back()}
			/>

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
					<>
						<p className={styles.offline}>{t('media.offline')}</p>
						<MediaView mediaRef={mediaRef} media={null} sources={[]} entry={entry} />
					</>
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
