import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Modal } from '@shared/ui'

import { mediaPreviewModel } from '@entities/media'
import type { MediaTrailer } from '@entities/media'

import styles from './TrailerModal.module.scss'

export function youtubeUrl(trailer: MediaTrailer | null | undefined): string | null {
	return trailer?.site === 'youtube' && trailer.id
		? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.id)}`
		: null
}

interface PlayerProps {
	host: string
	id: string
	title: string
	url: string
	thumbnail: string | null
}

function Player({ host, id, title, url, thumbnail }: PlayerProps) {
	const { t } = useTranslation()
	const frameRef = useRef<HTMLIFrameElement>(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		const onMessage = (event: MessageEvent<{ source?: unknown; state?: unknown } | null>) => {
			if (event.origin !== host || event.source !== frameRef.current?.contentWindow) {
				return
			}

			if (event.data?.source === 'mediary-trailer' && event.data.state === 'error') {
				setFailed(true)
			}
		}

		window.addEventListener('message', onMessage)

		return () => window.removeEventListener('message', onMessage)
	}, [host])

	// Автор відео може заборонити вбудовування: тоді лишається посилання на YouTube
	if (failed) {
		return (
			<a className={styles.fallback} href={url} target='_blank' rel='noreferrer'>
				{thumbnail && <img src={thumbnail} alt='' draggable={false} />}

				<span className={styles.fallbackLabel}>
					<Icon name='common/external-link' size={20} />
					{t('media.trailerEmbedBlocked')}
				</span>
			</a>
		)
	}

	return (
		<iframe
			ref={frameRef}
			className={styles.frame}
			src={`${host}/trailer?v=${encodeURIComponent(id)}&mode=watch`}
			title={t('media.trailerFor', { title })}
			allow='autoplay; encrypted-media; fullscreen'
			allowFullScreen
		/>
	)
}

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
