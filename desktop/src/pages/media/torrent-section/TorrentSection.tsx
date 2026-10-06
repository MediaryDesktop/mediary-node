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
}

// The title's torrents: search and manual adding up top, new episodes on their
// own below that, and what is downloading for it. The search itself is a sheet
// the title page holds, so the header's download button opens the same one.
export function TorrentSection({ mediaRef, title }: TorrentSectionProps) {
	const { t } = useTranslation()

	const openSearch = useUnit(searchOpened)
	const [adding, setAdding] = useState(false)
	const close = useCallback(() => setAdding(false), [])

	return (
		<section className={styles.root}>
			<div className={styles.header}>
				<div className={styles.heading}>
					<h2 className={styles.title}>{t('torrents.list.title')}</h2>
					<p className={styles.hint}>{t('torrents.section.hint')}</p>
				</div>

				<div className={styles.actions}>
					<Button
						variant='secondary'
						startIcon={<Icon name='common/link' size={16} />}
						onClick={() => setAdding(true)}
					>
						{t('torrents.add')}
					</Button>
					<Button startIcon={<Icon name='common/search' size={16} />} onClick={openSearch}>
						{t('torrents.search.open')}
					</Button>
				</div>
			</div>

			<AutoDownloadPanel mediaRef={mediaRef} title={title} />

			<div className={styles.block}>
				<h3 className={styles.subtitle}>{t('torrents.list.forTitle')}</h3>
				<TorrentDownloadList mediaRef={mediaRef} />
			</div>

			<AddTorrentDrawer open={adding} mediaRef={mediaRef} title={title} onClose={close} />
		</section>
	)
}
