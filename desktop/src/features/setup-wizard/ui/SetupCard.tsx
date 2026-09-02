import type { ReactNode } from 'react'

import styles from './SetupCard.module.scss'

export interface SetupCardProps {
	icon?: ReactNode
	title?: string
	description?: string
	children: ReactNode
}

export function SetupCard({ icon, title, description, children }: SetupCardProps) {
	return (
		<section className={styles.card}>
			{title && (
				<header className={styles.header}>
					{icon && <span className={styles.icon}>{icon}</span>}

					<div>
						<h2 className={styles.title}>{title}</h2>
						{description && <p className={styles.description}>{description}</p>}
					</div>
				</header>
			)}

			<div className={styles.body}>{children}</div>
		</section>
	)
}
