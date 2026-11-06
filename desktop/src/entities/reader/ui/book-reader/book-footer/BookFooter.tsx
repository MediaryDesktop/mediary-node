import type { CSSProperties, ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'

import type { BookLocation } from '../types'

import styles from './BookFooter.module.scss'

export interface BookFooterProps {
	location: BookLocation | null
	disabled: boolean
	onSeek: (fraction: number) => void
	children?: ReactNode
}

const STEPS = 1000

export function BookFooter({ location, disabled, onSeek, children }: BookFooterProps) {
	const { t } = useTranslation()

	const percent = location ? Math.round(location.fraction * 100) : 0
	const pages =
		location?.current && location.total
			? t('reader.pageOf', { current: location.current, total: location.total })
			: null

	return (
		<footer className={styles.bottom}>
			<input
				type='range'
				className={styles.seek}
				min={0}
				max={STEPS}
				value={Math.round((location?.fraction ?? 0) * STEPS)}
				disabled={disabled}
				aria-label={t('reader.book.position')}
				style={{ '--progress': `${percent}%` } as CSSProperties}
				onChange={event => onSeek(Number(event.target.value) / STEPS)}
			/>
			<span className={styles.count}>
				{t('reader.book.percent', { percent })}
				{pages && <> · {pages}</>}
			</span>

			{children}
		</footer>
	)
}
