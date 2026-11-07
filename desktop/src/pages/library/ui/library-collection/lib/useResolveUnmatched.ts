import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useNodeData } from '@infra/node'

import type { LibraryCollectionEntry } from '@entities/library-item'
import { mediaPreviewModel } from '@entities/media'
import type { MediaDetails } from '@entities/media'

type ResolvedTitle = NonNullable<LibraryCollectionEntry['title']>

export function resolvedTitle(ref: string, media: MediaDetails): ResolvedTitle {
	return {
		media_ref: media.media_ref,
		media_type: media.media_type as ResolvedTitle['media_type'],
		title: media.title.user_preferred ?? media.title.romaji ?? media.title.english ?? ref,
		cover_image: media.cover_image ?? undefined,
		cover_color: media.cover_color ?? undefined,
		format: media.format ?? undefined,
		episodes: (media.media_type === 'manga' ? media.chapters : media.episodes) ?? undefined
	}
}

export function useResolveUnmatched(entries: LibraryCollectionEntry[]): Record<string, ResolvedTitle> {
	const previews = useUnit(mediaPreviewModel.$previews)

	const unmatched = useMemo(
		() => entries.filter(entry => !entry.title).map(entry => entry.media_ref),
		[entries]
	)

	useNodeData(mediaPreviewModel.previewsRequested, { params: unmatched, enabled: unmatched.length > 0 })

	return useMemo(
		() =>
			Object.fromEntries(
				unmatched.flatMap(ref => {
					const media = previews[ref]

					return media ? [[ref, resolvedTitle(ref, media)]] : []
				})
			),
		[unmatched, previews]
	)
}
