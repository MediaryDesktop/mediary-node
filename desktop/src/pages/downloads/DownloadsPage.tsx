import { useTranslation } from '@shared/i18n'

import { AutoDownloadRules } from '@features/auto-download-torrents'
import { MangaDownloadList } from '@features/download-chapters'
import { TorrentDownloadList } from '@features/download-torrent'

import styles from './DownloadsPage.module.scss'

export function DownloadsPage() {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>{t('nav.downloads')}</h1>

			<TorrentDownloadList />

			<AutoDownloadRules />

			<MangaDownloadList />
		</div>
	)
}
