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
	// Online chapters are still on the way; the list may grow.
	loadingOnline: boolean
}

// useTitleChapters gathers a manga title's chapters from the library and from every
// linked source, as one list. The title page shows it; the reader walks it.
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

	// Each query serves every title, so an answer counts only if it is this title's.
	const online = chaptersData && chaptersData.mediaRef === mediaRef ? chaptersData : null
	const links = (linksData && linksData.mediaRef === mediaRef ? linksData.links : null) ?? []

	const rows = useMemo(() => {
		const options: ChapterOption[] = []

		for (const file of files?.files.items ?? []) {
			// Specials and extras are not chapters in reading order, and a file the last
			// scan did not find cannot be opened.
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
			// The source asks for the credit: language and translators sit next to
			// the chapter wherever it is listed.
			const credit = [chapter.language?.toUpperCase(), ...(chapter.groups ?? [])]
				.filter(Boolean)
				.join(' · ')
			// A plugin learns a chapter's pages only when it is opened: 0 is unknown.
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
