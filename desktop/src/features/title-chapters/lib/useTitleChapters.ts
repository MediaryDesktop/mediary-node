import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { useNodeData } from '@infra/node'

import { titleFilesQuery } from '@entities/library-item'
import { mangaChaptersQuery, mangaLinksQuery, mangaSourcesQuery } from '@entities/manga-source'
import type { MangaLink, MangaSource, MangaSourceProblem } from '@entities/manga-source'
import type { ChapterRow } from '@entities/reader'

import { titleChapterRows } from './chapter-options'

export interface TitleChapters {
	rows: ChapterRow[]
	sources: MangaSource[]
	links: MangaLink[]
	problems: MangaSourceProblem[]
	loadingOnline: boolean
}

export function useTitleChapters(mediaRef: string | undefined): TitleChapters {
	const { t } = useTranslation()

	const [files, sourcesData, linksData, chaptersData, chaptersPending] = useUnit([
		titleFilesQuery.$data,
		mangaSourcesQuery.$data,
		mangaLinksQuery.$data,
		mangaChaptersQuery.$data,
		mangaChaptersQuery.$pending
	])

	useNodeData(titleFilesQuery, {
		params: { mediaRef: mediaRef ?? '', kind: 'manga' },
		enabled: Boolean(mediaRef)
	})
	useNodeData(mangaSourcesQuery, { enabled: Boolean(mediaRef) })
	useNodeData(mangaLinksQuery, { params: mediaRef, enabled: Boolean(mediaRef) })
	useNodeData(mangaChaptersQuery, { params: mediaRef, enabled: Boolean(mediaRef) })

	const online = chaptersData && chaptersData.mediaRef === mediaRef ? chaptersData : null
	const links = (linksData && linksData.mediaRef === mediaRef ? linksData.links : null) ?? []

	const rows = useMemo(
		() =>
			titleChapterRows(mediaRef, files?.files.items ?? [], online?.chapters ?? [], {
				library: t('mangaSources.chapters.library'),
				external: t('mangaSources.chapters.external'),
				pages: count => t('mangaSources.chapters.pages', { count })
			}),
		[files, online, mediaRef, t]
	)

	return {
		rows,
		sources: sourcesData?.sources ?? [],
		links,
		problems: online?.problems ?? [],
		loadingOnline: chaptersPending
	}
}
