import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'

import type { TorrentSetup } from '@entities/torrent'

import styles from './DownloadSummary.module.scss'

export interface DownloadSummaryProps {
	active: number
	inLibrary: number
	setup: TorrentSetup
}

// Above the all-titles list: how much is under way, how much is in, and whether the
// client answers.
export function DownloadSummary({ active, inLibrary, setup }: DownloadSummaryProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.summary}>
			<span>{t('torrents.list.active', { count: active })}</span>
			<span>{t('torrents.list.inLibrary', { count: inLibrary })}</span>
			{setup.clientConfigured && (
				<span className={styles.client}>
					<span
						className={clsx(
							styles.dot,
							setup.clientReachable === false ? styles.down : setup.clientReachable && styles.up
						)}
					/>
					{setup.clientKind === 'embedded'
						? t('torrents.settings.embedded')
						: setup.clientKind === 'torbox'
							? 'TorBox'
							: 'qBittorrent'}
				</span>
			)}
		</div>
	)
}
