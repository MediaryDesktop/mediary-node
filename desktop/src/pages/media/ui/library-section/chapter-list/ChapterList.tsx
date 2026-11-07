import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'
import { Button, EmptyState, Icon, Pagination } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { extensionsQuery } from '@entities/extension'
import {
	deleteMangaLinkMutation,
	mangaDownloadSettingsQuery,
	mangaDownloadsQuery
} from '@entities/manga-source'
import { filterChapters, isChapterRead } from '@entities/reader'
import type { ChapterOption, ChapterRow as Row } from '@entities/reader'
import { updateTrackerEntryMutation } from '@entities/tracker'

import { downloadRequested } from '@features/download-chapters'
import { LinkSourceDrawer } from '@features/link-manga-source'
import { useTitleChapters } from '@features/title-chapters'

import { ChapterFilters } from './chapter-filters/ChapterFilters'
import { ChapterRow } from './chapter-row/ChapterRow'
import styles from './ChapterList.module.scss'
import {
	activeDownload,
	chapterState,
	latestDownloads,
	matchesSearch,
	matchesStatus,
	pageCount,
	pageOf,
	presentSources,
	readProgress,
	savableOption,
	sortRows,
	sourceCounts
} from './lib/chapters'
import type { SortOrder, StatusFilter } from './lib/chapters'
import { SourceChips } from './source-chips/SourceChips'

export interface ChapterListProps {
	mediaRef: string
	title: string
	progress: number
	listed: boolean
}

const ALL = 'all'
const FILTER_KEY = 'mediary.chapterSource'
const ORDER_KEY = 'mediary.chapterOrder'

export function ChapterList({ mediaRef, title, progress, listed }: ChapterListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [unlink, updateEntry, downloadsData, save, extensions] = useUnit([
		deleteMangaLinkMutation.start,
		updateTrackerEntryMutation.start,
		mangaDownloadsQuery.$data,
		downloadRequested,
		extensionsQuery.$data
	])

	useNodeData(mangaDownloadsQuery)
	useNodeData(mangaDownloadSettingsQuery)
	useNodeData(extensionsQuery)

	const { rows, sources, links, problems, loadingOnline } = useTitleChapters(mediaRef)

	const [filter, setFilter] = useState(() => readStored(FILTER_KEY) ?? ALL)
	const [order, setOrder] = useState<SortOrder>(() =>
		readStored(ORDER_KEY) === 'oldest' ? 'oldest' : 'newest'
	)
	const [status, setStatus] = useState<StatusFilter>('all')
	const [query, setQuery] = useState('')
	const [page, setPage] = useState(1)
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

	const [linking, setLinking] = useState<string | null | undefined>(undefined)
	const closeLinking = useCallback(() => setLinking(undefined), [])

	if (rows.length === 0 && sources.length === 0) {
		return null
	}

	const present = presentSources(rows)
	const counts = sourceCounts(rows)
	const icons = new Map(
		(extensions?.extensions ?? []).flatMap(ext =>
			ext.icon ? [[`plugin:${ext.id}`, ext.icon] as const] : []
		)
	)

	const active = present.has(filter) ? filter : ALL
	const shown = sortRows(
		(active === ALL ? rows : filterChapters(rows, active)).filter(
			row => matchesStatus(row, status, progress) && matchesSearch(row, query)
		),
		order
	)
	const unlinked = sources.filter(source => !links.some(link => link.source === source.id))

	const pages = pageCount(shown.length)
	const current = Math.min(page, pages)
	const visible = pageOf(shown, current)

	const downloads = latestDownloads(downloadsData?.downloads ?? [])
	const savable = new Map<string, ChapterOption>()
	for (const row of shown) {
		const option = savableOption(row, downloads)
		if (option) {
			savable.set(row.key, option)
		}
	}

	const picked = [...savable].filter(([key]) => selected.has(key)).map(([, option]) => option)

	const startOver =
		<T,>(set: (value: T) => void) =>
		(value: T) => {
			set(value)
			setPage(1)
		}

	const changeFilter = startOver((value: string) => {
		setFilter(value)
		writeStored(FILTER_KEY, value)
	})

	const changeOrder = startOver((value: SortOrder) => {
		setOrder(value)
		writeStored(ORDER_KEY, value)
	})

	const toggle = (keys: string[], on: boolean) =>
		setSelected(previous => {
			const next = new Set(previous)
			keys.forEach(key => (on ? next.add(key) : next.delete(key)))

			return next
		})

	const saveAll = (options: ChapterOption[]) => {
		save(options.map(option => option.ref))
		setSelected(new Set())
	}

	const open = (option: ChapterOption) => {
		if (option.externalUrl) {
			window.open(option.externalUrl, '_blank', 'noreferrer')

			return
		}

		void navigate({ to: '/read/$ref', params: { ref: option.ref } })
	}

	const markRead = (row: Row, read: boolean) => {
		const next = readProgress(row.number, read, progress)
		if (next === null) {
			return
		}

		updateEntry({
			mediaRef,
			patch: listed ? { progress: next } : { status: 'CURRENT', progress: next }
		})
	}

	return (
		<section className={styles.card}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<Icon name='common/book-open' size={40} className={styles.bookIcon} />
					<div className={styles.headingText}>
						<h2 className={styles.title}>
							{t('mangaSources.chapters.heading')} ⋅ {rows.length}
						</h2>
						<p className={styles.subtitle}>{t('mangaSources.chapters.subtitle')}</p>
					</div>
				</div>

				<div className={styles.actions}>
					{savable.size > 1 && (
						<Button
							variant='primary'
							startIcon={<Icon name='common/download' size={16} />}
							onClick={() => saveAll([...savable.values()])}
						>
							{t('mangaSources.downloads.saveAll')}
						</Button>
					)}

					{unlinked.length > 0 && (
						<Button
							startIcon={<Icon name='common/link' size={16} />}
							onClick={() => setLinking(unlinked[0]?.id ?? null)}
						>
							{t('mangaSources.chapters.link')}
						</Button>
					)}
				</div>
			</header>

			{rows.length > 0 && (
				<div className={styles.controls}>
					<SourceChips
						sources={present}
						counts={counts}
						total={rows.length}
						icons={icons}
						allValue={ALL}
						active={active}
						onFilter={changeFilter}
						links={links}
						onRelink={setLinking}
						onUnlink={source => unlink({ mediaRef, source })}
					/>

					<ChapterFilters
						query={query}
						onQueryChange={startOver(setQuery)}
						status={status}
						onStatusChange={startOver(setStatus)}
						order={order}
						onOrderChange={changeOrder}
					/>
				</div>
			)}

			{rows.length === 0 && links.length === 0 && (
				<EmptyState
					title={t('mangaSources.chapters.noChapters.title')}
					description={t('mangaSources.chapters.noChapters.description')}
				/>
			)}

			{problems.map(problem => (
				<p key={problem.source} className={styles.problem}>
					{problem.source_name ? `${problem.source_name}: ${problem.detail}` : problem.detail}
				</p>
			))}

			{links.length > 0 &&
				!loadingOnline &&
				problems.length === 0 &&
				!links.some(link => present.has(link.source)) && (
					<p className={styles.message}>{t('mangaSources.chapters.empty')}</p>
				)}

			{rows.length > 0 && shown.length === 0 && (
				<EmptyState title={t('mangaSources.chapters.nothingFound')} />
			)}

			{visible.length > 0 && (
				<div role='table' className={styles.table} aria-label={t('mangaSources.chapters.heading')}>
					{visible.map(row => {
						const from = savable.get(row.key)
						const download = activeDownload(row, downloads)
						const read = isChapterRead(row.number, progress)
						const markable = readProgress(row.number, !read, progress) !== null

						return (
							<ChapterRow
								key={row.key}
								row={row}
								state={chapterState(row, download, progress)}
								read={read}
								icons={icons}
								selected={from ? selected.has(row.key) : undefined}
								onSelect={on => toggle([row.key], on)}
								onOpen={open}
								onSave={from ? () => save([from.ref]) : undefined}
								onToggleRead={markable ? () => markRead(row, !read) : undefined}
							/>
						)
					})}
				</div>
			)}

			{(savable.size > 0 || pages > 1) && (
				<footer className={styles.footer}>
					{savable.size > 0 && (
						<div className={styles.selection}>
							<span className={styles.picked}>
								{t('mangaSources.chapters.selected', {
									picked: picked.length,
									total: savable.size
								})}
							</span>
							<Button
								size='small'
								variant='primary'
								disabled={picked.length === 0}
								startIcon={<Icon name='common/download' size={16} />}
								onClick={() => saveAll(picked)}
							>
								{t('mangaSources.chapters.saveSelected')}
							</Button>
						</div>
					)}

					<Pagination
						className={styles.pagination}
						page={current}
						pages={pages}
						onPageChange={setPage}
					/>
				</footer>
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
