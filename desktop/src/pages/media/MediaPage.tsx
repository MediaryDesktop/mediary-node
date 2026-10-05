import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, PageTransition } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'
import { mediaDetailsModel } from '@entities/media'
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

	const details = data?.media.media_ref === mediaRef ? data : null
	const failed = !details && failedMediaRef === mediaRef

	return (
		<PageTransition className={styles.root}>
			<Button
				variant='ghost'
				size='small'
				className={styles.back}
				startIcon={<Icon name='common/arrow-left' size={18} />}
				onClick={() => router.history.back()}
			/>

			{details && (
				<MediaView
					mediaRef={mediaRef}
					media={details.media}
					sources={details.sources ?? []}
					entry={entry}
				/>
			)}

			{!details && !failed && <MediaHeroSkeleton />}

			{failed && entry && (
				<>
					<p className={styles.offline}>{t('media.offline')}</p>
					<MediaView mediaRef={mediaRef} media={null} sources={[]} entry={entry} />
				</>
			)}

			{failed && !entry && (
				<div className={styles.failure}>
					<p>{t('media.failed')}</p>
					<Button size='small' onClick={() => requestDetails(mediaRef)}>
						{t('media.retry')}
					</Button>
				</div>
			)}
		</PageTransition>
	)
}
