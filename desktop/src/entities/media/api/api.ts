import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type MediaTitle = NodeSchemas['TitleNames']
export type MediaDate = NodeSchemas['FuzzyDate']
export type MediaAiringEpisode = NodeSchemas['AiringEpisode']
export type MediaTrailer = NodeSchemas['Trailer']
export type RelatedMedia = NodeSchemas['RelatedMedia']
export type MediaSource = NodeSchemas['Source']

export type MediaDetails = Omit<NodeSchemas['MediaDetails'], 'next_airing_episode' | 'trailer'> & {
	next_airing_episode: MediaAiringEpisode | null
	trailer: MediaTrailer | null
}

export interface MediaDetailsResponse {
	media: MediaDetails
	sources: MediaSource[] | null
}

export const fetchMediaDetailsFx = createNodeRequestFx<string, MediaDetailsResponse>(mediaRef => ({
	url: `/v1/media/${encodeURIComponent(mediaRef)}`
}))
