import type { ReactNode } from 'react'

import styles from './AuthFormWrapper.module.scss'

export interface AuthFormWrapperProps {
	eyebrow?: string
	title: string
	description?: string
	children: ReactNode
}

export function AuthFormWrapper({ eyebrow, title, description, children }: AuthFormWrapperProps) {
	return (
		<div className={styles.wrapper}>
			<header className={styles.header}>
				{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
				<h2 className={styles.title}>{title}</h2>
				{description && <p className={styles.description}>{description}</p>}
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
