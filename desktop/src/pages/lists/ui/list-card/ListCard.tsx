import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'

import styles from './ListCard.module.scss'

export interface ListCardProps {
	name: string
	count: number
	covers: string[]
	updatedAt?: string | null
	badge: ReactNode
	menu?: ReactNode
	onOpen: () => void
}

export function ListCard({ name, count, covers, updatedAt, badge, menu, onOpen }: ListCardProps) {
	const { t, i18n } = useTranslation()

	const shown = covers.slice(0, 3)
	const hidden = Math.max(count - shown.length, 0)

	const meta = [
		count > 0 ? t('lists.titleCount', { count }) : t('lists.card.empty'),
		updatedAt && t('lists.card.updated', { when: formatRelativeTime(updatedAt, i18n.language) })
	].filter(Boolean)

	return (
		<article className={styles.card}>
			<button type='button' className={styles.open} onClick={onOpen}>
				<span className={styles.collage} aria-hidden>
					{[0, 1, 2].map(slot => (
						<span key={slot} className={styles.tile}>
							{shown[slot] && <img src={shown[slot]} alt='' loading='lazy' draggable={false} />}
						</span>
					))}

					{hidden > 0 && (
						<span className={styles.overflow}>{t('lists.card.overflow', { count: hidden })}</span>
					)}
				</span>

				<span className={styles.text}>
					<span className={styles.name}>{name}</span>
					<span className={styles.meta}>{meta.join(' · ')}</span>
					<span className={styles.badge}>{badge}</span>
				</span>
			</button>

			{menu && <div className={styles.menu}>{menu}</div>}
		</article>
	)
}
