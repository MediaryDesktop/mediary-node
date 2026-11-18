import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'

import { searchManualCoversFx } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { coverPreviewUrl } from './cover'
import type { CoverSelection } from './cover'

// The cover the form will save. Besides the user's own pick, the assistant may
// put one there: the first catalog poster for the title it recognised. Such a
// cover is "automatic" — a later suggestion may replace or drop it — until the
// user picks one themselves.
export function useCoverChoice(initialCoverUrl: string | null | undefined) {
	const searchCovers = useUnit(searchManualCoversFx)
	const [cover, setCover] = useState<CoverSelection>({ kind: 'keep' })
	const automatic = useRef(false)

	const pickCover = (chosen: CoverSelection) => {
		automatic.current = false
		setCover(chosen)
	}

	const dropAutoCover = () => {
		if (automatic.current) {
			automatic.current = false
			setCover({ kind: 'keep' })
		}
	}

	// A title that has a cover, or one the user picked, keeps it.
	const findPoster = async (found: ManualDraft) => {
		if (initialCoverUrl || (cover.kind !== 'keep' && !automatic.current)) {
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
				setCover(current =>
					current.kind === 'keep' || automatic.current
						? { kind: 'url', value: image.url, previewUrl: image.thumbnail, source: 'search' }
						: current
				)
				automatic.current = true
			} else {
				dropAutoCover()
			}
		} catch {}
	}

	return {
		cover,
		pickCover,
		previewCoverUrl: coverPreviewUrl(cover, initialCoverUrl),
		findPoster,
		dropAutoCover
	}
}
