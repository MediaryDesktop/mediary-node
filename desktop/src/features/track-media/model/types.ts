import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

export interface EntryTarget {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

// A title that is not on any list yet, as search, the library or the title page
// know it.
export interface NewEntryTarget {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
}
