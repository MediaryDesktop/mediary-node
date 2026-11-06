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

export type MediaEpisode = NodeSchemas['Episode']

export type MediaEpisodeList = Omit<NodeSchemas['EpisodeList'], 'episodes'> & {
	episodes: MediaEpisode[] | null
}

export interface MediaEpisodesResponse {
	episodes: MediaEpisodeList
	sources: MediaSource[] | null
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
	url: `/v1/media/${encodeURIComponent(mediaRef)}`,
	timeout: 20_000
}))

export const fetchMediaEpisodesFx = createNodeRequestFx<string, MediaEpisodesResponse>(mediaRef => ({
	url: `/v1/media/${encodeURIComponent(mediaRef)}/episodes`,
	timeout: 20_000
}))

export const searchMediaFx = createNodeRequestFx<MediaSearchQuery, MediaSearchResponse>(query => ({
	url: '/v1/media/search',
	query: searchParams(query),
	timeout: 15_000
}))

export const fetchMediaFilterOptionsFx = createNodeRequestFx<MediaSearchType, MediaFilterOptionsResponse>(
	type => ({
		url: '/v1/media/filter-options',
		query: { type },
		timeout: 15_000
	})
)

export type TMDBSettings = Omit<NodeSchemas['TMDBSettings'], '$schema'>

export const fetchTMDBSettingsFx = createNodeRequestFx<void, TMDBSettings>({
	url: '/v1/tmdb/settings'
})

export const setTMDBKeyFx = createNodeRequestFx<string, TMDBSettings>(apiKey => ({
	url: '/v1/tmdb/settings',
	method: 'PUT',
	body: { api_key: apiKey },
	timeout: 20_000
}))

export type GoogleBooksSettings = Omit<NodeSchemas['GoogleBooksSettings'], '$schema'>

export const fetchGoogleBooksSettingsFx = createNodeRequestFx<void, GoogleBooksSettings>({
	url: '/v1/google-books/settings'
})

export const setGoogleBooksKeyFx = createNodeRequestFx<string, GoogleBooksSettings>(apiKey => ({
	url: '/v1/google-books/settings',
	method: 'PUT',
	body: { api_key: apiKey },
	timeout: 20_000
}))

export type ManualDraft = Omit<NodeSchemas['ManualDraft'], '$schema'>
export type ManualHint = Omit<NodeSchemas['ManualHint'], '$schema'>
export type ManualSuggestion = Omit<NodeSchemas['ManualSuggestion'], '$schema'>
export type CoverSource = Omit<NodeSchemas['CoverSource'], '$schema'>
export type CoverImage = NodeSchemas['Image']

export interface ManualMediaResponse {
	media: MediaDetails
}

export const createManualMediaFx = createNodeRequestFx<ManualDraft, ManualMediaResponse>(draft => ({
	url: '/v1/media/manual',
	method: 'POST',
	body: draft,
	timeout: 15_000
}))

export interface UpdateManualMediaParams {
	id: string
	draft: ManualDraft
}

export const updateManualMediaFx = createNodeRequestFx<UpdateManualMediaParams, ManualMediaResponse>(
	({ id, draft }) => ({
		url: `/v1/media/manual/${encodeURIComponent(id)}`,
		method: 'PUT',
		body: draft,
		timeout: 15_000
	})
)

export const deleteManualMediaFx = createNodeRequestFx<string, void>(id => ({
	url: `/v1/media/manual/${encodeURIComponent(id)}`,
	method: 'DELETE',
	timeout: 15_000
}))

export const suggestManualMediaFx = createNodeRequestFx<ManualHint, ManualSuggestion>(hint => ({
	url: '/v1/media/manual/suggest',
	method: 'POST',
	body: hint,
	timeout: 100_000
}))

export type AISettings = Omit<NodeSchemas['AISettings'], '$schema'>
export type AIProvider = AISettings['provider']
export type SetAISettingsParams = Omit<NodeSchemas['AISettingsUpdate'], '$schema'>

export const fetchAISettingsFx = createNodeRequestFx<void, AISettings>({ url: '/v1/ai/settings' })

export const setAISettingsFx = createNodeRequestFx<SetAISettingsParams, AISettings>(body => ({
	url: '/v1/ai/settings',
	method: 'PUT',
	body,
	timeout: 30_000
}))

export interface ManualCoverSearch {
	type: MediaSearchType
	title: string
	year?: number
}

export interface ManualCoverCandidatesResponse {
	images: CoverImage[] | null
	sources: MediaSource[] | null
}

export const searchManualCoversFx = createNodeRequestFx<ManualCoverSearch, ManualCoverCandidatesResponse>(
	({ type, title, year }) => ({
		url: '/v1/media/manual/cover/search',
		query: year ? { type, title, year: String(year) } : { type, title },
		timeout: 15_000
	})
)

export interface SetManualCoverParams {
	id: string
	source: CoverSource
}

export const setManualCoverFx = createNodeRequestFx<SetManualCoverParams, ManualMediaResponse>(
	({ id, source }) => ({
		url: `/v1/media/manual/${encodeURIComponent(id)}/cover`,
		method: 'PUT',
		body: source,
		timeout: 20_000
	})
)

export const deleteManualCoverFx = createNodeRequestFx<string, ManualMediaResponse>(id => ({
	url: `/v1/media/manual/${encodeURIComponent(id)}/cover`,
	method: 'DELETE',
	timeout: 15_000
}))
