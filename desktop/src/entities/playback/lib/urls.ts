import { nodeMediaUrl } from '@infra/node'

export function directUrl(fileId: number): string {
	return nodeMediaUrl(`/v1/playback/files/${fileId}/direct`)
}

export function subtitleUrl(fileId: number, index: number): string {
	return nodeMediaUrl(`/v1/playback/files/${fileId}/subtitles/${index}`)
}

export function fontUrl(fileId: number, index: number): string {
	return nodeMediaUrl(`/v1/playback/files/${fileId}/fonts/${index}`)
}
