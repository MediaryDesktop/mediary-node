import type { ReactNode } from 'react'

import styles from './EpisodeRow.module.scss'

export interface EpisodeTextProps {
	label: string
	name: string | null
	duration: string | null
	overview: string | null
	badge?: ReactNode
	children?: ReactNode
}

export function EpisodeText({ label, name, duration, overview, badge, children }: EpisodeTextProps) {
	return (
		<span className={styles.episodeContent}>
			<span className={styles.episodeHeader}>
				<span className={styles.episodeLabel}>{label}</span>
				{duration && <span className={styles.episodeDuration}>{duration}</span>}
				{badge}
			</span>
			{name && <span className={styles.episodeName}>{name}</span>}
			{overview && <span className={styles.episodeOverview}>{overview}</span>}
			{children}
		</span>
	)
}
