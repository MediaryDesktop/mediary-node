import { useTranslation } from '@shared/i18n'

import { MangaDownloadList } from '@features/download-chapters'

import styles from './DownloadsPage.module.scss'

export function DownloadsPage() {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>{t('nav.downloads')}</h1>

			<MangaDownloadList />
		</div>
	)
}
