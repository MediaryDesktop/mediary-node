import { renderIcon } from '../icon/Icon'
import type { IconLike } from '../icon/Icon'

import styles from './EmptyCard.module.scss'

export interface EmptyCardProps {
	icon: IconLike
	title: string
	description: string
}

// A dashed placeholder for a settings card's list before it holds anything —
// a torrent search source, an OPDS server. The card's own header already
// carries the add action, so this never needs one of its own.
export function EmptyCard({ icon, title, description }: EmptyCardProps) {
	return (
		<div className={styles.root}>
			<span className={styles.badge}>{renderIcon(icon, 28)}</span>
			<p className={styles.title}>{title}</p>
			<p className={styles.description}>{description}</p>
		</div>
	)
}
