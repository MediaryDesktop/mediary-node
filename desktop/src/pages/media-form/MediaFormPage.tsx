import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, PageTransition, Skeleton } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { mediaDetailsModel } from '@entities/media'

import { draftFromDetails, manualId, ManualMediaForm } from '@features/manual-media-form'
import type { ManualMediaType } from '@features/manual-media-form'

import styles from './MediaFormPage.module.scss'

export type MediaFormPageProps =
	// A create with no kind leaves the choice to the user rather than defaulting
	// to one, which they would not notice was wrong.
	{ mode: 'create'; mediaType?: ManualMediaType; title: string } | { mode: 'edit'; mediaRef: string }

export function MediaFormPage(props: MediaFormPageProps) {
	if (props.mode === 'create') {
		return (
			<PageTransition className={styles.root}>
				<ManualMediaForm
					// A different kind in the address is a different form, not an edit of this one.
					key={props.mediaType ?? 'unset'}
					mode='create'
					typeUnset={props.mediaType === undefined}
					initialDraft={{ media_type: props.mediaType ?? 'anime', title: props.title }}
					cancelTo='/search'
				/>
			</PageTransition>
		)
	}

	return <EditMediaForm mediaRef={props.mediaRef} />
}

function EditMediaForm({ mediaRef }: { mediaRef: string }) {
	const { t } = useTranslation()

	const { data, failedRef, requestDetails, nodeReady } = useUnit({
		data: mediaDetailsModel.$data,
		failedRef: mediaDetailsModel.$failedMediaRef,
		requestDetails: mediaDetailsModel.detailsRequested,
		nodeReady: $nodeReady
	})

	useEffect(() => {
		if (nodeReady) {
			requestDetails(mediaRef)
		}
	}, [mediaRef, requestDetails, nodeReady])

	const media = data?.media.media_ref === mediaRef ? data.media : null
	const failed = !media && failedRef === mediaRef

	return (
		<PageTransition className={styles.root}>
			{media && media.editable ? (
				<ManualMediaForm
					mode='edit'
					id={manualId(mediaRef)}
					initialDraft={draftFromDetails(media)}
					initialCoverUrl={media.cover_image}
					cancelTo={`/media/${mediaRef}`}
				/>
			) : media ? (
				<EmptyState title={t('manualMedia.notEditable')} />
			) : failed ? (
				<EmptyState title={t('media.failed')} />
			) : (
				<Skeleton width='100%' height='24rem' radius='var(--radius)' />
			)}
		</PageTransition>
	)
}
