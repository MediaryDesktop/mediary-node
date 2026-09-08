import type { ReactNode } from 'react'

import styles from './SetupStepPanel.module.scss'

export interface SetupStepPanelProps {
	notice?: ReactNode
	title: string
	description: string
	children: ReactNode
}

export function SetupStepPanel({ notice, title, description, children }: SetupStepPanelProps) {
	return (
		<section className={styles.panel}>
			{notice}

			<header className={styles.header}>
				<h1 className={styles.title}>{title}</h1>
				<p className={styles.description}>{description}</p>
			</header>

			<div className={styles.content}>{children}</div>
		</section>
	)
}
