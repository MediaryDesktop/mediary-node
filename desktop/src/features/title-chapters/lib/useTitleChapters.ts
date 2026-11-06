import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { $nodeReady } from '@infra/node'

import { fileName, fileTitle, titleFilesQuery } from '@entities/library-item'
import { mangaChaptersQuery, mangaLinksQuery, mangaSourcesQuery } from '@entities/manga-source'
import type { MangaLink, MangaSource, MangaSourceProblem } from '@entities/manga-source'
import { chapterNumberFromName, LOCAL_SOURCE, localRef, mergeChapters } from '@entities/reader'
import type { ChapterOption, ChapterRow } from '@entities/reader'

export interface TitleChapters {
	rows: ChapterRow[]
	sources: MangaSource[]
	links: MangaLink[]
	problems: MangaSourceProblem[]
	loadingOnline: boolean
}

export function useTitleChapters(mediaRef: string | undefined): TitleChapters {
	const { t } = useTranslation()

	const [
		files,
		loadFiles,
		sourcesData,
		loadSources,
		linksData,
		loadLinks,
		chaptersData,
		loadChapters,
		chaptersPending,
		nodeReady
	] = useUnit([
		titleFilesQuery.$data,
		titleFilesQuery.start,
		mangaSourcesQuery.$data,
		mangaSourcesQuery.start,
		mangaLinksQuery.$data,
		mangaLinksQuery.start,
		mangaChaptersQuery.$data,
		mangaChaptersQuery.start,
		mangaChaptersQuery.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (mediaRef && nodeReady) {
			loadFiles({ mediaRef, kind: 'manga' })
			loadSources()
			loadLinks(mediaRef)
			loadChapters(mediaRef)
		}
	}, [mediaRef, loadFiles, loadSources, loadLinks, loadChapters, nodeReady])

	const online = chaptersData && chaptersData.mediaRef === mediaRef ? chaptersData : null
	const links = (linksData && linksData.mediaRef === mediaRef ? linksData.links : null) ?? []

	const rows = useMemo(() => {
		const options: ChapterOption[] = []

		for (const file of files?.files.items ?? []) {
			if (
				file.match?.media_ref !== mediaRef ||
				file.ignored ||
				file.missing ||
				file.parsed.form === 'special' ||
				file.parsed.form === 'extra'
			) {
				continue
			}

			const counted = file.match?.episode ?? file.parsed.episode
			const number =
				counted === undefined || counted === null
					? chapterNumberFromName(file.rel_path)
					: String(counted)

			options.push({
				ref: localRef(file.id),
				number,
				title: fileTitle(file),
				source: LOCAL_SOURCE,
				sourceName: t('mangaSources.chapters.library'),
				detail: fileName(file)
			})
		}

		for (const chapter of online?.chapters ?? []) {
			const credit = [chapter.language?.toUpperCase(), ...(chapter.groups ?? [])]
				.filter(Boolean)
				.join(' · ')
			const size = chapter.external_url
				? t('mangaSources.chapters.external')
				: chapter.pages > 0
					? t('mangaSources.chapters.pages', { count: chapter.pages })
					: ''

			options.push({
				ref: chapter.ref,
				number: chapter.number ?? null,
				title: chapter.title,
				source: chapter.source,
				sourceName: chapter.source_name,
				detail: [credit, size].filter(Boolean).join(' · '),
				language: chapter.language,
				groups: chapter.groups ?? undefined,
				pages: chapter.pages,
				externalUrl: chapter.external_url
			})
		}

		return mergeChapters(options)
	}, [files, online, mediaRef, t])

	return {
		rows,
		sources: sourcesData?.sources ?? [],
		links,
		problems: online?.problems ?? [],
		loadingOnline: chaptersPending
	}
}
