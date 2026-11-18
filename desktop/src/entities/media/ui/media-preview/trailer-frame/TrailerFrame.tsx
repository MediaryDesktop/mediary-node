import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import styles from '../MediaPreview.module.scss'

const TRAILER_DELAY = 300
const REVEAL_FALLBACK_MS = 6000

export interface TrailerFrameProps {
	host: string
	id: string
	title: string
}

interface TrailerMessage {
	source?: unknown
	state?: unknown
}

export function TrailerFrame({ host, id, title }: TrailerFrameProps) {
	const { t } = useTranslation()
	const frameRef = useRef<HTMLIFrameElement>(null)
	const [mounted, setMounted] = useState(false)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const timer = window.setTimeout(() => setMounted(true), TRAILER_DELAY)

		return () => window.clearTimeout(timer)
	}, [])

	useEffect(() => {
		if (!mounted) {
			return
		}

		let confirmed = false

		const onMessage = (event: MessageEvent<TrailerMessage | null>) => {
			if (event.origin !== host || event.source !== frameRef.current?.contentWindow) {
				return
			}

			if (event.data?.source === 'mediary-trailer') {
				confirmed = true
				setVisible(event.data.state === 'playing')
			}
		}

		window.addEventListener('message', onMessage)

		const fallback = window.setTimeout(() => {
			if (!confirmed) {
				setVisible(true)
			}
		}, REVEAL_FALLBACK_MS)

		return () => {
			window.removeEventListener('message', onMessage)
			window.clearTimeout(fallback)
		}
	}, [host, mounted])

	if (!mounted) {
		return null
	}

	return (
		<div className={clsx(styles.trailer, visible && styles.visible)}>
			<iframe
				ref={frameRef}
				src={`${host}/trailer?v=${encodeURIComponent(id)}`}
				title={t('media.trailerFor', { title })}
				allow='autoplay; encrypted-media'
				tabIndex={-1}
			/>
		</div>
	)
}
