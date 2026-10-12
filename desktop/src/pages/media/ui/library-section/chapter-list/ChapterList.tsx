import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'
import { Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	deleteMangaLinkMutation,
	mangaDownloadSettingsQuery,
	mangaDownloadsQuery
} from '@entities/manga-source'
import { filterChapters, isChapterRead } from '@entities/reader'
import type { ChapterOption } from '@entities/reader'

import { downloadRequested } from '@features/download-chapters'
import { LinkSourceDrawer } from '@features/link-manga-source'
import { useTitleChapters } from '@features/title-chapters'

import { ChapterRow } from './chapter-row/ChapterRow'
import { ChapterToolbar } from './chapter-toolbar/ChapterToolbar'
import styles from './ChapterList.module.scss'
import { activeDownload, latestDownloads, presentSources, savableOption } from './lib/chapters'

export interface ChapterListProps {
	mediaRef: string
	title: string
	progress: number
	coverColor: string | null
}

const ALL = 'all'
const FILTER_KEY = 'mediary.chapterSource'

// Every chapter of the title, from the library and from the user's servers, as one
// list. A chapter held in several places is one row that opens the nearest copy.
export function ChapterList({ mediaRef, title, progress, coverColor }: ChapterListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [unlink, downloadsData, loadDownloads, loadDownloadSettings, save, nodeReady] = useUnit([
		deleteMangaLinkMutation.start,
		mangaDownloadsQuery.$data,
		mangaDownloadsQuery.start,
		mangaDownloadSettingsQuery.start,
		downloadRequested,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			loadDownloads()
			loadDownloadSettings()
		}
	}, [loadDownloads, loadDownloadSettings, nodeReady])

	const { rows, sources, links, problems, loadingOnline } = useTitleChapters(mediaRef)

	const [filter, setFilter] = useState(() => readStored(FILTER_KEY) ?? ALL)

	// undefined: closed; otherwise the source to start the search on.
	const [linking, setLinking] = useState<string | null | undefined>(undefined)
	const closeLinking = useCallback(() => setLinking(undefined), [])

	if (rows.length === 0 && sources.length === 0) {
		return null
	}

	const present = presentSources(rows)

	// A remembered source this title does not have shows everything instead.
	const active = present.has(filter) ? filter : ALL
	const shown = active === ALL ? rows : filterChapters(rows, active)
	const unlinked = sources.filter(source => !links.some(link => link.source === source.id))

	const changeFilter = (value: string) => {
		setFilter(value)
		writeStored(FILTER_KEY, value)
	}

	const downloads = latestDownloads(downloadsData?.downloads ?? [])
	const unsaved = shown
		.map(row => savableOption(row, downloads))
		.filter((option): option is ChapterOption => option !== null)

	const open = (option: ChapterOption) => {
		if (option.externalUrl) {
			window.open(option.externalUrl, '_blank', 'noreferrer')

			return
		}

		void navigate({ to: '/read/$ref', params: { ref: option.ref } })
	}

	return (
		<section className={styles.section}>
			<div className={styles.header}>
				<h2 className={styles.title}>{t('media.chapters.title', { count: shown.length })}</h2>

				<div className={styles.actions}>
					{unsaved.length > 1 && (
						<Button
							size='small'
							startIcon={<Icon name='common/download' size={16} />}
							onClick={() => save(unsaved.map(option => option.ref))}
						>
							{t('mangaSources.downloads.saveAll')}
						</Button>
					)}

					{unlinked.length > 0 && (
						<Button
							size='small'
							startIcon={<Icon name='common/link' size={16} />}
							onClick={() => setLinking(unlinked[0]?.id ?? null)}
						>
							{t('mangaSources.chapters.link')}
						</Button>
					)}
				</div>
			</div>

			<ChapterToolbar
				sources={present}
				allValue={ALL}
				active={active}
				onFilter={changeFilter}
				links={links}
				onRelink={setLinking}
				onUnlink={source => unlink({ mediaRef, source })}
			/>

			{problems.map(problem => (
				<p key={problem.source} className={styles.problem}>
					{problem.source_name ? `${problem.source_name}: ${problem.detail}` : problem.detail}
				</p>
			))}

			{links.length > 0 &&
				!loadingOnline &&
				problems.length === 0 &&
				!links.some(link => present.has(link.source)) && (
					<p className={styles.empty}>{t('mangaSources.chapters.empty')}</p>
				)}

			{shown.length > 0 && (
				<ul className={styles.list}>
					{shown.map(row => {
						const from = savableOption(row, downloads)

						return (
							<ChapterRow
								key={row.key}
								row={row}
								read={isChapterRead(row.number, progress)}
								accent={coverColor}
								onOpen={open}
								download={activeDownload(row, downloads)}
								onSave={from ? () => save([from.ref]) : undefined}
							/>
						)
					})}
				</ul>
			)}

			<LinkSourceDrawer
				open={linking !== undefined}
				mediaRef={mediaRef}
				title={title}
				sources={sources}
				initialSource={linking ?? undefined}
				onClose={closeLinking}
			/>
		</section>
	)
}
