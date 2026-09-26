import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { NowPlayingBar, playbackQuery } from '@entities/playback'

import { ManageEntryDrawer, RateEntryDrawer } from '@features/track-media'

import styles from './AppLayout.module.scss'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: ReactNode }) {
	const startPlayback = useUnit(playbackQuery.start)

	useEffect(() => {
		startPlayback()
	}, [startPlayback])

	return (
		<div className={styles.root}>
			<Sidebar />

			<main className={styles.main}>{children}</main>

			<NowPlayingBar />

			<ManageEntryDrawer />
			<RateEntryDrawer />
		</div>
	)
}
