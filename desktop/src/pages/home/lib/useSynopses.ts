import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useNodeData } from '@infra/node'

import { mediaPreviewModel } from '@entities/media'
import type { MediaDate } from '@entities/media'

export interface Synopsis {
	description?: string
	start_date?: MediaDate
}

export function useSynopses(refs: string[]): Record<string, Synopsis> {
	const previews = useUnit(mediaPreviewModel.$previews)
	const key = refs.join('|')

	useNodeData(mediaPreviewModel.previewsRequested, { params: refs, enabled: refs.length > 0 })

	return useMemo(
		() =>
			Object.fromEntries(
				refs.flatMap(ref => {
					const media = previews[ref]

					return media
						? [[ref, { description: media.description, start_date: media.start_date }]]
						: []
				})
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `refs`, a new array on every render.
		[key, previews]
	)
}
