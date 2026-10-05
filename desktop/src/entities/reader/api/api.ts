import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type ReaderChapter = NodeSchemas['ChapterBody']
export type ReaderPage = NodeSchemas['Page']

// The reference holds colons, and later an OPDS entry id that may hold anything.
export const fetchChapterFx = createNodeRequestFx<string, NodeSchemas['ChapterOutputBody']>(ref => ({
	url: `/v1/reader/chapters/${encodeURIComponent(ref)}`,

	// Listing a large archive reads its whole central directory.
	timeout: 20_000
}))

export interface ReportPageParams {
	ref: string
	page: number
}

export const reportReaderPageFx = createNodeRequestFx<ReportPageParams, NodeSchemas['ReadOutputBody']>(
	({ ref, page }) => ({
		url: `/v1/reader/chapters/${encodeURIComponent(ref)}/progress`,
		method: 'POST',
		body: { page }
	})
)
