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

// A book from Open Library takes two requests at one a second, and a page of cards
// queues several: the node needs longer than the default to answer the last.
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

// A title no source knows, described by the user. The node keeps it as given and
// builds its page from it under a manual:<id> reference.
export type ManualMediaDraft = Omit<NodeSchemas['ManualDraft'], '$schema'>
export type ManualMediaType = ManualMediaDraft['media_type']
export type ManualMediaFormat = NonNullable<ManualMediaDraft['format']>
export type ManualMediaStatus = NonNullable<ManualMediaDraft['status']>

export interface ManualMediaResponse {
	media: MediaDetails
}

export interface UpdateManualMediaParams {
	id: string
	draft: ManualMediaDraft
}

export const createManualMediaFx = createNodeRequestFx<ManualMediaDraft, ManualMediaResponse>(draft => ({
	url: '/v1/media/manual',
	method: 'POST',
	body: draft
}))

export const updateManualMediaFx = createNodeRequestFx<UpdateManualMediaParams, ManualMediaResponse>(
	({ id, draft }) => ({
		url: `/v1/media/manual/${encodeURIComponent(id)}`,
		method: 'PUT',
		body: draft
	})
)

export const deleteManualMediaFx = createNodeRequestFx<string, void>(id => ({
	url: `/v1/media/manual/${encodeURIComponent(id)}`,
	method: 'DELETE'
}))

// What the user knows of a title before Claude fills in the rest, and the draft
// it comes back with. Nothing is stored until the user saves the draft.
export type ManualMediaHint = Omit<NodeSchemas['ManualHint'], '$schema'>
export type ManualMediaSuggestion = Omit<NodeSchemas['ManualSuggestion'], '$schema'>

// Claude can take a while on an obscure title, and the node retries a busy one.
export const suggestManualMediaFx = createNodeRequestFx<ManualMediaHint, ManualMediaSuggestion>(hint => ({
	url: '/v1/media/manual/suggest',
	method: 'POST',
	body: hint,
	timeout: 180_000
}))

// Whether Claude can fill in titles, with which model, and whether the user saved
// a key. The key itself never comes back from the node.
export type AISettings = Omit<NodeSchemas['AISettings'], '$schema'>
export type AISettingsPatch = Omit<NodeSchemas['AISettingsInputBody'], '$schema'>

export const fetchAISettingsFx = createNodeRequestFx<void, AISettings>({
	url: '/v1/ai/settings'
})

// A key is checked with Anthropic before the node keeps it.
export const setAISettingsFx = createNodeRequestFx<AISettingsPatch, AISettings>(patch => ({
	url: '/v1/ai/settings',
	method: 'PUT',
	body: patch,
	timeout: 30_000
}))

// Whether movies and shows can be looked up, and with whose key. The key itself
// never comes back from the node.
export type TMDBSettings = Omit<NodeSchemas['TMDBSettings'], '$schema'>

export const fetchTMDBSettingsFx = createNodeRequestFx<void, TMDBSettings>({
	url: '/v1/tmdb/settings'
})

// An empty key forgets the user's own and goes back to the one the build ships with.
export const setTMDBKeyFx = createNodeRequestFx<string, TMDBSettings>(apiKey => ({
	url: '/v1/tmdb/settings',
	method: 'PUT',
	body: { api_key: apiKey },
	timeout: 20_000
}))

// Google Books answers for the books Open Library does not know, with the same
// choice of keys as TMDB.
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
