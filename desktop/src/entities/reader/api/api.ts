import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type ReaderChapter = NodeSchemas['ChapterBody']
export type ReaderPage = NodeSchemas['Page']

export const fetchChapterFx = createNodeRequestFx<number, NodeSchemas['ChapterOutputBody']>(fileId => ({
	url: `/v1/reader/files/${fileId}/chapter`,

	// Listing a large archive reads its whole central directory.
	timeout: 20_000
}))

export interface ReportPageParams {
	fileId: number
	page: number
}

export const reportReaderPageFx = createNodeRequestFx<ReportPageParams, NodeSchemas['ReadOutputBody']>(
	({ fileId, page }) => ({
		url: `/v1/reader/files/${fileId}/progress`,
		method: 'POST',
		body: { page }
	})
)
