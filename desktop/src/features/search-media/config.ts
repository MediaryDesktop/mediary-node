import type {
	MediaSearchFormat,
	MediaSearchSeason,
	MediaSearchSort,
	MediaSearchStatus,
	MediaSearchType
} from '@entities/media'

export const SEARCH_TYPES = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama'
] as const satisfies readonly MediaSearchType[]

// AniList's catalog has tags, formats, seasons and statuses to filter by; TMDB,
// which serves the rest, has genres, year and score only.
export function isAniListType(type: MediaSearchType): boolean {
	return type === 'anime' || type === 'manga'
}

export const SEARCH_SORTS = [
	'POPULARITY_DESC',
	'SEARCH_MATCH',
	'TRENDING_DESC',
	'SCORE_DESC',
	'FAVOURITES_DESC',
	'START_DATE_DESC',
	'TITLE_ROMAJI'
] as const satisfies readonly MediaSearchSort[]

// TMDB has no formats to filter by: a movie is a movie and a show is a show.
export const SEARCH_FORMATS = {
	anime: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
	manga: ['MANGA', 'NOVEL', 'ONE_SHOT'],
	movie: [],
	series: [],
	dorama: []
} as const satisfies Record<MediaSearchType, readonly MediaSearchFormat[]>

export const SEARCH_STATUSES = [
	'RELEASING',
	'FINISHED',
	'NOT_YET_RELEASED',
	'HIATUS',
	'CANCELLED'
] as const satisfies readonly MediaSearchStatus[]

export const SEARCH_SEASONS = [
	'WINTER',
	'SPRING',
	'SUMMER',
	'FALL'
] as const satisfies readonly MediaSearchSeason[]

export const SEARCH_SCORES = [90, 80, 70, 60, 50] as const

export const EARLIEST_YEAR = 1940

export const PER_PAGE = 30

// How long typing settles before a request goes out.
export const CHANGE_PAUSE_MS = 400

export const BROWSE_SORT: MediaSearchSort = 'POPULARITY_DESC'
export const RELEVANCE_SORT: MediaSearchSort = 'SEARCH_MATCH'
