import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, PageHeader, PageTransition, SegmentedControl } from '@shared/ui'

import { bookDownloadsQuery } from '@entities/book-source'
import { mangaDownloadsQuery } from '@entities/manga-source'
import { torrentDownloadsQuery, torrentRulesQuery } from '@entities/torrent'

import { AutoDownloadRules } from '@features/auto-download-torrents'
import { MangaDownloadList } from '@features/download-chapters'
import { BookDownloadList } from '@features/download-free-book'
import { TorrentDownloadList } from '@features/download-torrent'

import styles from './DownloadsPage.module.scss'

type Tab = 'torrents' | 'auto' | 'manga' | 'books'

// Everything the node brings to disk, one kind per tab: torrents, the rules that
// add them by themselves, saved manga chapters and free books.
export function DownloadsPage() {
	const { t } = useTranslation()

	const [tab, setTab] = useState<Tab>('torrents')

	const [torrents, rules, manga, books] = useUnit([
		torrentDownloadsQuery.$data,
		torrentRulesQuery.$data,
		mangaDownloadsQuery.$data,
		bookDownloadsQuery.$data
	])

	const label = (text: string, count: number | undefined) => (count ? `${text} (${count})` : text)

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.downloads')}
				icon={<Icon name='common/download' size={24} />}
				subtitle={t('downloads.subtitle')}
			/>

			<SegmentedControl
				size='large'
				className={styles.switcher}
				label={t('nav.downloads')}
				value={tab}
				onValueChange={setTab}
				items={[
					{
						value: 'torrents',
						label: label(t('downloads.tabs.torrents'), torrents?.downloads?.length)
					},
					{ value: 'auto', label: label(t('downloads.tabs.auto'), rules?.rules?.length) },
					{ value: 'manga', label: label(t('downloads.tabs.manga'), manga?.downloads?.length) },
					{ value: 'books', label: label(t('downloads.tabs.books'), books?.downloads?.length) }
				]}
			/>

			{tab === 'torrents' && <TorrentDownloadList />}
			{tab === 'auto' && <AutoDownloadRules />}
			{tab === 'manga' && <MangaDownloadList hideTitle />}
			{tab === 'books' && <BookDownloadList />}
		</PageTransition>
	)
}
