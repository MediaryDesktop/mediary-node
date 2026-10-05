import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Button, DropdownMenu, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	deleteMangaLinkMutation,
	mangaChaptersQuery,
	mangaLinksQuery,
	mangaSourcesQuery
} from '@entities/manga-source'
import type { MangaChapter } from '@entities/manga-source'

import { LinkSourceDrawer } from '@features/link-manga-source'

import styles from './ChapterList.module.scss'
import online from './OnlineChapters.module.scss'

export interface OnlineChaptersProps {
	mediaRef: string
	title: string
	progress: number
	coverColor: string | null
}

// Chapters from the user's OPDS servers. Nothing shows until a server is added in
// the settings; after that the title can be linked to a series on it.
export function OnlineChapters({ mediaRef, title, progress, coverColor }: OnlineChaptersProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [
		sourcesData,
		loadSources,
		linksData,
		loadLinks,
		chaptersData,
		loadChapters,
		chaptersPending,
		unlink,
		nodeReady
	] = useUnit([
		mangaSourcesQuery.$data,
		mangaSourcesQuery.start,
		mangaLinksQuery.$data,
		mangaLinksQuery.start,
		mangaChaptersQuery.$data,
		mangaChaptersQuery.start,
		mangaChaptersQuery.$pending,
		deleteMangaLinkMutation.start,
		$nodeReady
	])

	// undefined: closed; otherwise the source to start the search on.
	const [linking, setLinking] = useState<string | null | undefined>(undefined)
	const close = useCallback(() => setLinking(undefined), [])

	useEffect(() => {
		if (nodeReady) {
			loadSources()
			loadLinks(mediaRef)
			loadChapters(mediaRef)
		}
	}, [mediaRef, loadSources, loadLinks, loadChapters, nodeReady])

	const sources = sourcesData?.sources ?? []
	if (sources.length === 0) {
		return null
	}

	const links = (linksData?.mediaRef === mediaRef ? linksData.links : null) ?? []
	const current = chaptersData?.mediaRef === mediaRef ? chaptersData : null
	const chapters = current?.chapters ?? []
	const problems = current?.problems ?? []
	const unlinked = sources.filter(source => !links.some(link => link.source === source.id))

	const open = (chapter: MangaChapter) => {
		void navigate({ to: '/read/$ref', params: { ref: chapter.ref } })
	}

	return (
		<section className={styles.section}>
			<div className={online.header}>
				<h2 className={styles.title}>{t('mangaSources.chapters.title')}</h2>

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

			{links.length > 0 && (
				<ul className={online.links}>
					{links.map(link => (
						<li key={link.source} className={online.link}>
							<Icon name='common/database' size={16} />
							<span className={online.linkText}>
								{link.series_title || link.series_id}{' '}
								<span className={online.linkSource}>
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
										className={online.menu}
										aria-label={t('mangaSources.menu')}
									>
										<Icon name='common/more-vertical' size={16} />
									</button>
								}
							/>
						</li>
					))}
				</ul>
			)}

			{problems.map(problem => (
				<p key={problem.source} className={online.problem}>
					{problem.source_name ? `${problem.source_name}: ${problem.detail}` : problem.detail}
				</p>
			))}

			{links.length > 0 &&
				current &&
				chapters.length === 0 &&
				problems.length === 0 &&
				!chaptersPending && <p className={online.empty}>{t('mangaSources.chapters.empty')}</p>}

			{chapters.length > 0 && (
				<ul className={styles.list}>
					{chapters.map(chapter => {
						const read = isRead(chapter, progress)

						return (
							<li key={chapter.ref}>
								<button
									type='button'
									className={clsx(styles.row, read && styles.read)}
									style={
										coverColor
											? ({ '--accent-chapter': coverColor } as CSSProperties)
											: undefined
									}
									onClick={() => open(chapter)}
								>
									<span className={styles.number}>
										{chapter.number
											? t('reader.chapterNumber', { number: chapter.number })
											: '—'}
									</span>
									<span className={styles.name}>
										<span className={styles.nameText}>{chapter.title}</span>
										<span className={styles.file}>
											{t('mangaSources.chapters.from', { name: chapter.source_name })} ·{' '}
											{t('mangaSources.chapters.pages', { count: chapter.pages })}
										</span>
									</span>
									{read ? (
										<Badge tone='success'>{t('reader.read')}</Badge>
									) : (
										<Icon name='common/book-open' size={18} className={styles.open} />
									)}
								</button>
							</li>
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
				onClose={close}
			/>
		</section>
	)
}

// A chapter counts as read when the list's progress has reached it. An extra such
// as 12.5 is read once the list is past 12, as the reader never moves progress for it.
function isRead(chapter: MangaChapter, progress: number): boolean {
	const number = Number(chapter.number)

	return chapter.number !== undefined && Number.isFinite(number) && number > 0 && number <= progress
}
