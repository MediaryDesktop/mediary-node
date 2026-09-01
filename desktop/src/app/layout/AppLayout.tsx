import type { ReactNode } from 'react'

import { LanguageSwitcher } from '@features/switch-language'

import styles from './AppLayout.module.scss'
import { NodeStatusBadge } from './NodeStatusBadge'

export function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<span className={styles.brand}>Mediary</span>

				<div className={styles.headerActions}>
					<LanguageSwitcher />
					<NodeStatusBadge />
				</div>
			</header>

			<main className={styles.main}>{children}</main>
		</div>
	)
}
