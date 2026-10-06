import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, PageHeader, PageTransition, Tabs } from '@shared/ui'

import { mangaDownloadsQuery } from '@entities/manga-source'
import { torrentDownloadsQuery, torrentRulesQuery } from '@entities/torrent'

import { AutoDownloadRules } from '@features/auto-download-torrents'
import { MangaDownloadList } from '@features/download-chapters'
import { TorrentDownloadList } from '@features/download-torrent'

import styles from './DownloadsPage.module.scss'

type Tab = 'torrents' | 'auto' | 'manga'

// Everything the node brings to disk, one kind per tab: torrents, the rules that
// add them by themselves, and saved manga chapters.
export function DownloadsPage() {
	const { t } = useTranslation()

	const [tab, setTab] = useState<Tab>('torrents')

	const [torrents, rules, manga] = useUnit([
		torrentDownloadsQuery.$data,
		torrentRulesQuery.$data,
		mangaDownloadsQuery.$data
	])

	const label = (text: string, count: number | undefined) => (
		<span className={styles.tab}>
			{text}
			{count ? <span className={styles.count}>{count}</span> : null}
		</span>
	)

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.downloads')}
				icon={<Icon name='common/download' size={24} />}
				subtitle={t('downloads.subtitle')}
			/>

			<Tabs
				value={tab}
				onValueChange={setTab}
				label={t('nav.downloads')}
				items={[
					{
						value: 'torrents',
						label: label(t('downloads.tabs.torrents'), torrents?.downloads?.length),
						content: <TorrentDownloadList />
					},
					{
						value: 'auto',
						label: label(t('downloads.tabs.auto'), rules?.rules?.length),
						content: <AutoDownloadRules />
					},
					{
						value: 'manga',
						label: label(t('downloads.tabs.manga'), manga?.downloads?.length),
						content: <MangaDownloadList hideTitle />
					}
				]}
			/>
		</PageTransition>
	)
}
