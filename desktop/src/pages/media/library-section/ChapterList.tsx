import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Button, DropdownMenu, Icon, SegmentedControl } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	deleteMangaLinkMutation,
	mangaDownloadSettingsQuery,
	mangaDownloadsQuery
} from '@entities/manga-source'
import type { MangaDownload } from '@entities/manga-source'
import { filterChapters, isChapterRead, LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow as Row } from '@entities/reader'

import { downloadRequested } from '@features/download-chapters'
import { LinkSourceDrawer } from '@features/link-manga-source'
import { useTitleChapters } from '@features/title-chapters'

import styles from './ChapterList.module.scss'

export interface ChapterListProps {
	mediaRef: string
	title: string
	progress: number
	coverColor: string | null
}

const ALL = 'all'
const FILTER_KEY = 'mediary.chapterSource'

function readFilter(): string {
	try {
		return window.localStorage.getItem(FILTER_KEY) ?? ALL
	} catch {
		return ALL
	}
}

function writeFilter(value: string) {
	try {
		window.localStorage.setItem(FILTER_KEY, value)
	} catch {
		// A per-viewer convenience: without storage the filter just resets.
	}
}

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

	const [filter, setFilter] = useState(readFilter)

	// undefined: closed; otherwise the source to start the search on.
	const [linking, setLinking] = useState<string | null | undefined>(undefined)
	const closeLinking = useCallback(() => setLinking(undefined), [])

	if (rows.length === 0 && sources.length === 0) {
		return null
	}

	const present = new Map<string, string>()
	for (const row of rows) {
		for (const option of row.options) {
			present.set(option.source, option.sourceName)
		}
	}

	// A remembered source this title does not have shows everything instead.
	const active = present.has(filter) ? filter : ALL
	const shown = active === ALL ? rows : filterChapters(rows, active)
	const unlinked = sources.filter(source => !links.some(link => link.source === source.id))

	const changeFilter = (value: string) => {
		setFilter(value)
		writeFilter(value)
	}

	// The newest download of each chapter, by the copy it was saved from.
	const downloads = new Map<string, MangaDownload>()
	for (const item of downloadsData?.downloads ?? []) {
		if (!downloads.has(item.chapter_ref)) {
			downloads.set(item.chapter_ref, item)
		}
	}

	// A chapter the library does not hold can be saved from its first online copy,
	// unless that is already under way.
	const savable = (row: Row): ChapterOption | null => {
		if (row.options.some(option => option.source === LOCAL_SOURCE)) {
			return null
		}

		const online = row.options.find(option => option.source.startsWith('opds:'))
		const pending = row.options.some(option => isActive(downloads.get(option.ref)))

		return online && !pending ? online : null
	}

	const unsaved = shown.map(savable).filter((option): option is ChapterOption => option !== null)

	const open = (option: ChapterOption) => {
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

			{(links.length > 0 || present.size > 1) && (
				<div className={styles.toolbar}>
					{present.size > 1 && (
						<SegmentedControl
							label={t('mangaSources.chapters.filter')}
							value={active}
							onValueChange={changeFilter}
							items={[
								{ value: ALL, label: t('mangaSources.chapters.all') },
								...[...present].map(([value, label]) => ({ value, label }))
							]}
						/>
					)}

					{links.map(link => (
						<span key={link.source} className={styles.link}>
							<Icon name='common/database' size={16} />
							<span className={styles.linkText}>
								{link.series_title || link.series_id}{' '}
								<span className={styles.linkSource}>
									{t('mangaSources.chapters.from', { name: link.source_name })}
								</span>
							</span>

							<DropdownMenu
								items={[
									{
										id: 'relink',
										label: t('mangaSources.chapters.relink'),
										icon: 'common/search',
										onSelect: () => setLinking(link.source)
									},
									{
										id: 'unlink',
										label: t('mangaSources.chapters.unlink'),
										icon: 'common/trash',
										danger: true,
										onSelect: () => unlink({ mediaRef, source: link.source })
									}
								]}
								trigger={
									<button
										type='button'
										className={styles.linkMenu}
										aria-label={t('mangaSources.menu')}
									>
										<Icon name='common/more-vertical' size={16} />
									</button>
								}
							/>
						</span>
					))}
				</div>
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
					<p className={styles.empty}>{t('mangaSources.chapters.empty')}</p>
				)}

			{shown.length > 0 && (
				<ul className={styles.list}>
					{shown.map(row => {
						const from = savable(row)

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

function isActive(item: MangaDownload | undefined): boolean {
	return item?.state === 'queued' || item?.state === 'running'
}

function activeDownload(row: Row, downloads: Map<string, MangaDownload>): MangaDownload | undefined {
	for (const option of row.options) {
		const item = downloads.get(option.ref)
		if (isActive(item)) {
			return item
		}
	}

	return undefined
}

interface ChapterRowProps {
	row: Row
	read: boolean
	accent: string | null
	onOpen: (option: ChapterOption) => void
	// A download of this chapter under way.
	download?: MangaDownload
	onSave?: () => void
}

function ChapterRow({ row, read, accent, onOpen, download, onSave }: ChapterRowProps) {
	const { t } = useTranslation()
	const [first, ...others] = row.options

	if (!first) {
		return null
	}

	return (
		<li className={styles.item}>
			<button
				type='button'
				className={clsx(styles.row, read && styles.read)}
				style={accent ? ({ '--accent-chapter': accent } as CSSProperties) : undefined}
				onClick={() => onOpen(first)}
			>
				<span className={styles.number}>
					{row.number === null ? '—' : t('reader.chapterNumber', { number: row.number })}
				</span>
				<span className={styles.name}>
					<span className={styles.nameText}>{first.title}</span>
					<span className={styles.file}>
						<span className={clsx(styles.source, first.source === LOCAL_SOURCE && styles.local)}>
							{first.sourceName}
						</span>{' '}
						· {first.detail}
					</span>
				</span>
				{read ? (
					<Badge tone='success'>{t('reader.read')}</Badge>
				) : (
					<Icon name='common/book-open' size={18} className={styles.open} />
				)}
			</button>

			{others.length > 0 && (
				<DropdownMenu
					items={others.map(option => ({
						id: option.ref,
						label: `${option.sourceName} · ${option.detail}`,
						icon: 'common/book-open',
						onSelect: () => onOpen(option)
					}))}
					trigger={
						<button
							type='button'
							className={styles.copies}
							aria-label={t('mangaSources.chapters.copies')}
							title={t('mangaSources.chapters.copies')}
						>
							<Icon name='common/more-vertical' size={16} />
						</button>
					}
				/>
			)}

			{download ? (
				<span className={styles.saving} role='status'>
					{download.state === 'running' && download.pages_total > 0
						? t('mangaSources.downloads.progress', {
								done: download.pages_done,
								total: download.pages_total
							})
						: t(`mangaSources.downloads.states.${download.state}`)}
				</span>
			) : (
				onSave && (
					<button
						type='button'
						className={styles.copies}
						aria-label={t('mangaSources.downloads.save')}
						title={t('mangaSources.downloads.save')}
						onClick={onSave}
					>
						<Icon name='common/download' size={16} />
					</button>
				)
			)}
		</li>
	)
}
