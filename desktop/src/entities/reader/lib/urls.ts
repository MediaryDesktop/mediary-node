import { nodeMediaUrl } from '@infra/node'

export function pageUrl(fileId: number, index: number): string {
	return nodeMediaUrl(`/v1/reader/files/${fileId}/pages/${index}`)
}
