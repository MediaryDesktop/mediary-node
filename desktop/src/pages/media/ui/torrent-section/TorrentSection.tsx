import { useUnit } from 'effector-react'
import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { AutoDownloadPanel } from '@features/auto-download-torrents'
import { AddTorrentDrawer, TorrentDownloadList } from '@features/download-torrent'
import { searchOpened } from '@features/search-torrents'

import styles from './TorrentSection.module.scss'

export interface TorrentSectionProps {
	mediaRef: string
	title: string
	poster?: string | null
}

// The title's torrents: search and manual adding up top, new episodes on their
// own below that, and what is downloading for it. The search itself is a sheet
// the title page holds, so the header's download button opens the same one.
export function TorrentSection({ mediaRef, title, poster }: TorrentSectionProps) {
	const { t } = useTranslation()

	const openSearch = useUnit(searchOpened)
	const [adding, setAdding] = useState(false)
	const close = useCallback(() => setAdding(false), [])

	return (
		<section className={styles.root}>
			<div className={styles.header}>
				<div className={styles.heading}>
					<span className={styles.icon}>
						<Icon name='common/download' size={24} />
					</span>
					<div className={styles.text}>
						<h2 className={styles.title}>{t('torrents.list.title')}</h2>
						<p className={styles.hint}>{t('torrents.section.hint')}</p>
					</div>
				</div>

				<div className={styles.actions}>
					<Button
						variant='secondary'
						startIcon={<Icon name='common/link' size={16} />}
						onClick={() => setAdding(true)}
					>
						{t('torrents.add')}
					</Button>
					<Button
						variant='primary'
						startIcon={<Icon name='common/search' size={16} />}
						onClick={() => openSearch()}
					>
						{t('torrents.search.open')}
					</Button>
				</div>
			</div>

			{/* Rules count one run of episodes, as anime numbers them; a show
			    numbered by season is not supported by the node yet. */}
			{!mediaRef.startsWith('tmdb:tv:') && <AutoDownloadPanel mediaRef={mediaRef} title={title} />}

			<TorrentDownloadList mediaRef={mediaRef} title={title} poster={poster} />

			<AddTorrentDrawer open={adding} mediaRef={mediaRef} title={title} onClose={close} />
		</section>
	)
}
