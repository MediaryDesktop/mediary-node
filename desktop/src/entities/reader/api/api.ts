import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type ReaderChapter = NodeSchemas['ChapterBody']
export type ReaderPage = NodeSchemas['Page']

export const fetchChapterFx = createNodeRequestFx<string, NodeSchemas['ChapterOutputBody']>(ref => ({
	url: `/v1/reader/chapters/${encodeURIComponent(ref)}`,

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

export type ReaderBook = NodeSchemas['BookInfo']
export type ReaderBookPosition = NodeSchemas['BookPosition']
export type ReaderBookState = Omit<NodeSchemas['BookPositionOutputBody'], '$schema'>

export const fetchBookStateFx = createNodeRequestFx<number, ReaderBookState>(fileId => ({
	url: `/v1/reader/files/${fileId}/book/position`
}))

export interface SaveBookPositionParams {
	fileId: number
	locator: string
	fraction: number
}

export const saveBookPositionFx = createNodeRequestFx<SaveBookPositionParams, ReaderBookState>(
	({ fileId, locator, fraction }) => ({
		url: `/v1/reader/files/${fileId}/book/position`,
		method: 'PUT',
		body: { locator, fraction }
	})
)
