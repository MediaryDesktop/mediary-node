import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import styles from '../TrailerModal.module.scss'

export interface PlayerProps {
	host: string
	id: string
	title: string
	url: string
	thumbnail: string | null
}

export function Player({ host, id, title, url, thumbnail }: PlayerProps) {
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
