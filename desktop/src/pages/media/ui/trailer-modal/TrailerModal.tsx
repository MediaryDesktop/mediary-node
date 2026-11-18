import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Modal } from '@shared/ui'

import { mediaPreviewModel } from '@entities/media'
import type { MediaTrailer } from '@entities/media'

import { youtubeUrl } from './lib/youtube'
import { Player } from './player/Player'
import styles from './TrailerModal.module.scss'

export interface TrailerModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	trailer: MediaTrailer | null | undefined
}

export function TrailerModal({ open, onOpenChange, title, trailer }: TrailerModalProps) {
	const { t } = useTranslation()
	const [host, requestHost] = useUnit([
		mediaPreviewModel.$trailerHost,
		mediaPreviewModel.trailerHostRequested
	])
	const url = youtubeUrl(trailer)

	useEffect(() => {
		if (open) {
			requestHost()
		}
	}, [open, requestHost])

	if (!url || !trailer) {
		return null
	}

	return (
		<Modal open={open} onOpenChange={onOpenChange} title={t('media.trailerFor', { title })} size='lg'>
			<div className={styles.stage}>
				{open && host && (
					<Player
						host={host}
						id={trailer.id}
						title={title}
						url={url}
						thumbnail={trailer.thumbnail}
					/>
				)}
			</div>
		</Modal>
	)
}
