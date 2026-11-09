import { FallbackImage } from '@shared/ui'

import type { StreamPreview } from '../../../model/model'

import styles from './EpisodePreview.module.scss'

export interface EpisodePreviewProps {
	preview: StreamPreview
}

export function EpisodePreview({ preview }: EpisodePreviewProps) {
	return (
		<figure className={styles.preview}>
			<span className={styles.image} style={{ backgroundColor: preview.coverColor ?? undefined }}>
				<FallbackImage sources={preview.images} />
				{preview.duration && <span className={styles.duration}>{preview.duration}</span>}
			</span>
		</figure>
	)
}
