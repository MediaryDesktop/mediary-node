import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { NowPlayingBar, playbackQuery } from '@entities/playback'

import { DownloadFolderPrompt } from '@features/download-chapters'
import { DeleteListDialog, ListDrawer } from '@features/manage-lists'
import { ScanProgress } from '@features/scan-library'
import { ManageEntryDrawer, RateEntryDrawer } from '@features/track-media'

import styles from './AppLayout.module.scss'
import './lib/list-wiring'
import { Sidebar } from './sidebar/Sidebar'

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
			{/* After the entry drawer, so a list created from it opens on top. */}
			<ListDrawer />
			<DeleteListDialog />
			<DownloadFolderPrompt />

			<ScanProgress />
		</div>
	)
}
