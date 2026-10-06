import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { AddTorrentDrawer, TorrentDownloadList } from '@features/download-torrent'

import styles from './TorrentSection.module.scss'

export interface TorrentSectionProps {
	mediaRef: string
	title: string
}

// The title's torrents: what is downloading for it, and a way to add one. Search
// for releases comes with the provider plugins; until then the user brings the
// magnet or the .torrent file.
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

			<TorrentDownloadList mediaRef={mediaRef} hideTitle />

			<AddTorrentDrawer open={adding} mediaRef={mediaRef} title={title} onClose={close} />
		</section>
	)
}
