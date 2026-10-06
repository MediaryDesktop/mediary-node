import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { AddTorrentDrawer, TorrentDownloadList } from '@features/download-torrent'
import { TorrentSearch } from '@features/search-torrents'

import styles from './TorrentSection.module.scss'

export interface TorrentSectionProps {
	mediaRef: string
	title: string
}

// The title's torrents: a search of the user's own Jackett or Prowlarr, what is
// downloading, and a way to add a magnet or a .torrent file by hand.
export function TorrentSection({ mediaRef, title }: TorrentSectionProps) {
	const { t } = useTranslation()

	const [adding, setAdding] = useState(false)
	const close = useCallback(() => setAdding(false), [])

	return (
		<section className={styles.root}>
			<div className={styles.header}>
				<h2 className={styles.title}>{t('torrents.list.title')}</h2>

				<Button startIcon={<Icon name='common/plus' size={16} />} onClick={() => setAdding(true)}>
					{t('torrents.add')}
				</Button>
			</div>

			<TorrentSearch mediaRef={mediaRef} title={title} />

			<h3 className={styles.subtitle}>{t('torrents.list.forTitle')}</h3>

			<TorrentDownloadList mediaRef={mediaRef} hideTitle />

			<AddTorrentDrawer open={adding} mediaRef={mediaRef} title={title} onClose={close} />
		</section>
	)
}
