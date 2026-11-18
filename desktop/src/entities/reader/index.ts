export { ReaderView } from './ui/reader-view/ReaderView'
export { SourceIcon } from './ui/source-icon/SourceIcon'
export type { ReaderViewProps } from './ui/reader-view/ReaderView'

export { BookReaderView } from './ui/book-reader/BookReaderView'
export type { BookReaderViewProps } from './ui/book-reader/BookReaderView'
export type { BookLocation } from './ui/book-reader/types'
export { isPdf, loadBookFile } from './lib/book'

export { bookStateQuery, chapterQuery, readerModel, saveBookPositionMutation } from './model/model'
export {
	chapterNumberFromName,
	filterChapters,
	isChapterRead,
	LOCAL_SOURCE,
	mergeChapters,
	neighbourChapters
} from './lib/chapters'
export type { ChapterOption, ChapterRow } from './lib/chapters'
export { localRef, routeRef } from './lib/refs'
export type { ReaderBook, ReaderChapter } from './api/api'
