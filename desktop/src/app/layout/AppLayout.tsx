import type { ReactNode } from 'react'

import { ManageEntryDrawer, RateEntryDrawer } from '@features/track-media'

import styles from './AppLayout.module.scss'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className={styles.root}>
			<Sidebar />

			<main className={styles.main}>{children}</main>

			<ManageEntryDrawer />
			<RateEntryDrawer />
		</div>
	)
}
