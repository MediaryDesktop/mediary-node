import { nodeMediaUrl } from '@infra/node'

export function pageUrl(ref: string, index: number): string {
	return nodeMediaUrl(`/v1/reader/chapters/${encodeURIComponent(ref)}/pages/${index}`)
}
