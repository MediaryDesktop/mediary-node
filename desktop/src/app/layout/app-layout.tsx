import type { ReactNode } from 'react'

import styles from './app-layout.module.scss'
import { NodeStatusBadge } from './node-status-badge'

/**
 * The application frame: everything that is on screen regardless of route.
 *
 * `shell` owns the look of the application and imports no module. If something
 * here starts needing catalog or library data, that is the signal it belongs in
 * a module with the shell rendering a slot for it.
 */
export function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<span className={styles.brand}>Mediary</span>
				<NodeStatusBadge />
			</header>

			<main className={styles.main}>{children}</main>
		</div>
	)
}
