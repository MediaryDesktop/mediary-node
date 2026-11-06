import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

export interface EntryTarget {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

export interface NewEntryTarget {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
}
