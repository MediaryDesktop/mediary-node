import type { ReactNode } from 'react'

import { useNodeData } from '@infra/node'

import { NowPlayingBar, playbackQuery } from '@entities/playback'

import { DownloadFolderPrompt } from '@features/download-chapters'
import { BookFolderPrompt } from '@features/download-free-book'
import { DeleteListDialog, ListDrawer } from '@features/manage-lists'
import { ScanProgress } from '@features/scan-library'
import { ManageEntryDrawer, RateEntryDrawer } from '@features/track-media'

import styles from './AppLayout.module.scss'
import './lib/list-wiring'
import { NodeBanner } from './node-banner/NodeBanner'
import { Sidebar } from './sidebar/Sidebar'

export function AppLayout({ children }: { children: ReactNode }) {
	useNodeData(playbackQuery)

	return (
		<div className={styles.root}>
			<Sidebar />

			<main className={styles.main}>
				<NodeBanner />
				{children}
			</main>

			<NowPlayingBar />

			<ManageEntryDrawer />
			<RateEntryDrawer />
			<ListDrawer />
			<DeleteListDialog />
			<DownloadFolderPrompt />
			<BookFolderPrompt />

			<ScanProgress />
		</div>
	)
}
