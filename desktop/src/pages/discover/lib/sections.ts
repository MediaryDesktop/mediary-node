import type { IconName } from '@shared/ui'

import type { MediaSearchQuery, MediaSearchSeason, MediaSearchType } from '@entities/media'

export const DISCOVER_TABS = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama',
	'book'
] as const satisfies readonly MediaSearchType[]

export type DiscoverTab = (typeof DISCOVER_TABS)[number]

export function isDiscoverTab(value: unknown): value is DiscoverTab {
	return typeof value === 'string' && (DISCOVER_TABS as readonly string[]).includes(value)
}

const PER_PAGE = 20

export type SectionId =
	| 'trending'
	| 'thisSeason'
	| 'lastSeason'
	| 'upcoming'
	| 'movies'
	| 'manga'
	| 'manhwa'
	| 'manhua'
	| 'popular'
	| 'newest'
	| 'topRated'
	| 'fantasy'
	| 'scienceFiction'
	| 'mystery'

export const SECTION_ICONS: Record<SectionId, IconName> = {
	trending: 'common/flame',
	thisSeason: 'common/leaf',
	lastSeason: 'common/history',
	upcoming: 'common/hourglass',
	movies: 'common/clapperboard',
	manga: 'common/book-open-text',
	manhwa: 'common/smartphone',
	manhua: 'common/brush',
	popular: 'common/trending-up',
	newest: 'common/calendar-plus',
	topRated: 'common/trophy',
	fantasy: 'common/wand-sparkles',
	scienceFiction: 'common/rocket',
	mystery: 'common/fingerprint'
}

export interface DiscoverSection {
	key: string
	id: SectionId
	query: MediaSearchQuery
	season?: { season: MediaSearchSeason; year: number }
}

const SEASONS: readonly MediaSearchSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']

export function seasonOf(date: Date): { season: MediaSearchSeason; year: number } {
	return { season: SEASONS[Math.floor(date.getMonth() / 3)] ?? 'WINTER', year: date.getFullYear() }
}

export function previousSeason({ season, year }: { season: MediaSearchSeason; year: number }) {
	const index = SEASONS.indexOf(season)

	return index === 0
		? { season: 'FALL' as const, year: year - 1 }
		: { season: SEASONS[index - 1] ?? 'WINTER', year }
}

function section(tab: DiscoverTab, id: SectionId, query: Omit<MediaSearchQuery, 'type'>): DiscoverSection {
	return { key: `${tab}:${id}`, id, query: { type: tab, per_page: PER_PAGE, ...query } }
}

export function discoverSections(tab: DiscoverTab, now: Date): DiscoverSection[] {
	switch (tab) {
		case 'anime': {
			const current = seasonOf(now)
			const last = previousSeason(current)

			return [
				section(tab, 'trending', { sort: 'TRENDING_DESC' }),
				{
					...section(tab, 'thisSeason', {
						sort: 'POPULARITY_DESC',
						season: current.season,
						year: current.year
					}),
					key: `anime:thisSeason:${current.season}-${current.year}`,
					season: current
				},
				{
					...section(tab, 'lastSeason', {
						sort: 'SCORE_DESC',
						season: last.season,
						year: last.year
					}),
					key: `anime:lastSeason:${last.season}-${last.year}`,
					season: last
				},
				section(tab, 'upcoming', { sort: 'POPULARITY_DESC', statuses: ['NOT_YET_RELEASED'] }),
				section(tab, 'movies', { sort: 'TRENDING_DESC', formats: ['MOVIE'] })
			]
		}
		case 'manga':
			return [
				section(tab, 'manga', { sort: 'TRENDING_DESC', country: 'JP' }),
				section(tab, 'manhwa', { sort: 'TRENDING_DESC', country: 'KR' }),
				section(tab, 'manhua', { sort: 'TRENDING_DESC', country: 'CN' }),
				section(tab, 'topRated', { sort: 'SCORE_DESC' })
			]
		case 'movie':
		case 'series':
		case 'dorama':
			return [
				section(tab, 'popular', { sort: 'POPULARITY_DESC' }),
				section(tab, 'newest', { sort: 'START_DATE_DESC' }),
				section(tab, 'topRated', { sort: 'SCORE_DESC' })
			]
		case 'book':
			return [
				section(tab, 'popular', { sort: 'POPULARITY_DESC' }),
				section(tab, 'topRated', { sort: 'SCORE_DESC' }),
				section(tab, 'fantasy', { sort: 'POPULARITY_DESC', genres: ['Fantasy'] }),
				section(tab, 'scienceFiction', { sort: 'POPULARITY_DESC', genres: ['Science fiction'] }),
				section(tab, 'mystery', { sort: 'POPULARITY_DESC', genres: ['Mystery'] })
			]
	}
}
