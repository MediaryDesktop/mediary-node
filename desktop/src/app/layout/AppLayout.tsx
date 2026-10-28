import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { useUnitWatch } from '@shared/lib'

import { NowPlayingBar, playbackQuery } from '@entities/playback'

import { DownloadFolderPrompt } from '@features/download-chapters'
import { BookFolderPrompt } from '@features/download-free-book'
import { DeleteListDialog, ListDrawer } from '@features/manage-lists'
import { DeleteManualMediaDialog, ManualMediaDrawer, manualMediaModel } from '@features/manage-manual-media'
import { ScanProgress } from '@features/scan-library'
import { ManageEntryDrawer, RateEntryDrawer } from '@features/track-media'

import styles from './AppLayout.module.scss'
import './lib/list-wiring'
import './lib/manual-media-wiring'
import { Sidebar } from './sidebar/Sidebar'

export function AppLayout({ children }: { children: ReactNode }) {
	const navigate = useNavigate()
	const startPlayback = useUnit(playbackQuery.start)

	useEffect(() => {
		startPlayback()
	}, [startPlayback])

	useUnitWatch(manualMediaModel.created, ({ mediaRef, stay }) => {
		if (!stay) {
			void navigate({ to: '/media/$mediaRef', params: { mediaRef } })
		}
	})

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
			<ManualMediaDrawer />
			<DeleteManualMediaDialog />
			<DownloadFolderPrompt />
			<BookFolderPrompt />

			<ScanProgress />
		</div>
	)
}
