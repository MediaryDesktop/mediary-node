import { useUnit } from 'effector-react'
import { useState } from 'react'

import { searchManualCoversFx } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { coverPreviewUrl } from './cover'
import type { CoverSelection } from './cover'
import { coverFound, coverLost, NO_COVER_CHOICE } from './cover-choice'
import type { CoverChoice } from './cover-choice'

// The cover the form will save. Besides the user's own pick, the assistant may
// put one there: the first catalog poster for the title it recognised. Such a
// cover is "automatic" — a later suggestion may replace or drop it — until the
// user picks one themselves.
export function useCoverChoice(initialCoverUrl: string | null | undefined) {
	const searchCovers = useUnit(searchManualCoversFx)
	const [choice, setChoice] = useState<CoverChoice>(NO_COVER_CHOICE)

	const pickCover = (chosen: CoverSelection) => setChoice({ selection: chosen, automatic: false })

	const dropAutoCover = () => setChoice(coverLost)

	// A title that has a cover, or one the user picked, keeps it.
	const findPoster = async (found: ManualDraft) => {
		if (initialCoverUrl || (choice.selection.kind !== 'keep' && !choice.automatic)) {
			return
		}

		try {
			const result = await searchCovers({
				type: found.media_type,
				title: found.title,
				year: found.year
			})
			const image = result.images?.[0]

			if (image?.source === 'catalog') {
				setChoice(current =>
					coverFound(current, {
						kind: 'url',
						value: image.url,
						previewUrl: image.thumbnail,
						source: 'search'
					})
				)
			} else {
				dropAutoCover()
			}
		} catch {}
	}

	return {
		cover: choice.selection,
		pickCover,
		previewCoverUrl: coverPreviewUrl(choice.selection, initialCoverUrl),
		findPoster,
		dropAutoCover
	}
}
