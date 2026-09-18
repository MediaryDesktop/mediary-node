import { createNodeRequestFx } from '@infra/node'
import type { NodeOperation, NodeSchemas } from '@infra/node'

export type MediaTitle = NodeSchemas['TitleNames']
export type MediaDate = NodeSchemas['FuzzyDate']
export type MediaAiringEpisode = NodeSchemas['AiringEpisode']
export type MediaTrailer = NodeSchemas['Trailer']
export type RelatedMedia = NodeSchemas['RelatedMedia']
export type MediaSource = NodeSchemas['Source']
export type MediaFilterOptions = NodeSchemas['FilterOptions']
export type MediaFilterTag = NodeSchemas['FilterTag']

export type MediaDetails = Omit<NodeSchemas['MediaDetails'], 'next_airing_episode' | 'trailer'> & {
	next_airing_episode: MediaAiringEpisode | null
	trailer: MediaTrailer | null
}

export type MediaSummary = Omit<NodeSchemas['MediaSummary'], 'next_airing_episode'> & {
	next_airing_episode: MediaAiringEpisode | null
}

export type MediaSearchQuery = NonNullable<NodeOperation<'searchMedia'>['parameters']['query']>

export type MediaSearchSort = NonNullable<MediaSearchQuery['sort']>
export type MediaSearchFormat = NonNullable<MediaSearchQuery['formats']>[number]
export type MediaSearchStatus = NonNullable<MediaSearchQuery['statuses']>[number]
export type MediaSearchSeason = NonNullable<MediaSearchQuery['season']>
export type MediaSearchType = NonNullable<MediaSearchQuery['type']>

export interface MediaDetailsResponse {
	media: MediaDetails
	sources: MediaSource[] | null
}

export interface MediaSearchResponse {
	results: Omit<NodeSchemas['SearchPage'], 'items'> & { items: MediaSummary[] | null }
	sources: MediaSource[] | null
}

export interface MediaFilterOptionsResponse {
	options: MediaFilterOptions
	sources: MediaSource[] | null
}

type QueryValue = string | number | boolean | readonly string[] | undefined

function searchParams(query: MediaSearchQuery): Record<string, string> {
	const params: Record<string, string> = {}

	for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
		if (value === undefined || value === '' || value === false) {
			continue
		}

		if (Array.isArray(value)) {
			if (value.length > 0) {
				params[key] = value.join(',')
			}

			continue
		}

		params[key] = String(value)
	}

	return params
}

export const fetchMediaDetailsFx = createNodeRequestFx<string, MediaDetailsResponse>(mediaRef => ({
	url: `/v1/media/${encodeURIComponent(mediaRef)}`
}))

export const searchMediaFx = createNodeRequestFx<MediaSearchQuery, MediaSearchResponse>(query => ({
	url: '/v1/media/search',
	query: searchParams(query),
	timeout: 15_000
}))

export const fetchMediaFilterOptionsFx = createNodeRequestFx<void, MediaFilterOptionsResponse>({
	url: '/v1/media/filter-options',
	timeout: 15_000
})
