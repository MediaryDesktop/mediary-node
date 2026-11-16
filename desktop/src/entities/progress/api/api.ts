import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type TitleProgress = Omit<NodeSchemas['TitleProgress'], '$schema'>
export type EpisodeState = NodeSchemas['EpisodeState']
export type ChapterState = NodeSchemas['ChapterState']

export const fetchTitleProgressFx = createNodeRequestFx<string, TitleProgress>(mediaRef => ({
	url: `/v1/progress/titles/${encodeURIComponent(mediaRef)}`
}))

export interface SetEpisodeWatchedParams {
	mediaRef: string
	episode: number
	watched: boolean
}

export const setEpisodeWatchedFx = createNodeRequestFx<SetEpisodeWatchedParams, EpisodeState>(
	({ mediaRef, episode, watched }) => ({
		url: `/v1/progress/titles/${encodeURIComponent(mediaRef)}/episodes/${episode}`,
		method: 'PUT',
		body: { watched }
	})
)

export interface SetChapterReadParams {
	mediaRef: string
	chapter: string
	read: boolean
}

export const setChapterReadFx = createNodeRequestFx<SetChapterReadParams, ChapterState>(
	({ mediaRef, chapter, read }) => ({
		url: `/v1/progress/titles/${encodeURIComponent(mediaRef)}/chapters/${encodeURIComponent(chapter)}`,
		method: 'PUT',
		body: { read }
	})
)
