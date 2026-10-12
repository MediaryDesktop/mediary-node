import type {
	MediaSearchFormat,
	MediaSearchSeason,
	MediaSearchSort,
	MediaSearchStatus,
	MediaSearchType
} from '@entities/media'

export interface SearchFilters {
	type: MediaSearchType
	sort: MediaSearchSort
	genres: string[]
	tags: string[]
	formats: MediaSearchFormat[]
	statuses: MediaSearchStatus[]
	season: MediaSearchSeason | null
	year: number | null
	minScore: number | null
	adult: boolean
}

export interface SearchCriteria {
	title: string
	filters: SearchFilters
}
