export {
	addLibraryRootMutation,
	deleteLibraryFilesMutation,
	deleteLibraryMatchesMutation,
	deleteLibraryRootMutation,
	libraryCandidatesQuery,
	libraryCollectionQuery,
	libraryRootsQuery,
	libraryScanHistoryQuery,
	libraryScanQuery,
	libraryScanRunQuery,
	libraryTreeQuery,
	setLibraryFilesIgnoredMutation,
	setLibraryMatchesMutation,
	setLibraryMatchMutation,
	startLibraryScanMutation,
	titleFilesQuery,
	updateLibraryRootMutation
} from './model/queries'
export type { BulkOutcome } from './model/queries'

export { libraryModel } from './model/model'
export { AddRootMenu, LIBRARY_CONTENTS, LIBRARY_CONTENT_ICONS } from './ui/add-root-menu/AddRootMenu'
export type { ScanActivity, ScanPhase } from './model/scan'

export {
	fileDuration,
	fileName,
	fileNumber,
	fileSeason,
	fileTitle,
	isIgnored,
	isMatched,
	isTrackable
} from './lib/file'

export { fetchTitleFilesFx } from './api/api'

export type {
	LibraryCollectionEntry,
	LibraryContent,
	LibraryFile,
	LibraryFileParsed,
	LibraryMediaForm,
	LibraryRoot,
	LibraryScan,
	LibraryScanRunDetail,
	LibraryScanRunFileLog,
	LibraryScanRunGroup,
	LibrarySuggestion,
	LibraryTitle,
	SetLibraryFileIgnoredParams,
	SetLibraryMatchParams
} from './api/api'
