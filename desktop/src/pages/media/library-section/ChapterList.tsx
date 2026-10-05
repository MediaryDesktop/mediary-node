import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Button, DropdownMenu, Icon, SegmentedControl } from '@shared/ui'

import { deleteMangaLinkMutation } from '@entities/manga-source'
import { filterChapters, isChapterRead, LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow as Row } from '@entities/reader'

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
	const unlink = useUnit(deleteMangaLinkMutation.start)

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

	const open = (option: ChapterOption) => {
		void navigate({ to: '/read/$ref', params: { ref: option.ref } })
	}

	return (
		<section className={styles.section}>
			<div className={styles.header}>
				<h2 className={styles.title}>{t('media.chapters.title', { count: shown.length })}</h2>

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
					{shown.map(row => (
						<ChapterRow
							key={row.key}
							row={row}
							read={isChapterRead(row.number, progress)}
							accent={coverColor}
							onOpen={open}
						/>
					))}
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

interface ChapterRowProps {
	row: Row
	read: boolean
	accent: string | null
	onOpen: (option: ChapterOption) => void
}

function ChapterRow({ row, read, accent, onOpen }: ChapterRowProps) {
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
		</li>
	)
}
