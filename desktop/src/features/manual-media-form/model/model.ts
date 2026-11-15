import { createEffect } from 'effector'

import { ownRequest } from '@shared/factory'

import {
	createManualMediaFx,
	deleteManualCoverFx,
	deleteManualMediaMutation,
	setManualCoverFx,
	updateManualMediaFx
} from '@entities/media'
import type { ManualDraft } from '@entities/media'
import { updateTrackerEntryFx } from '@entities/tracker'

import { coverSource } from '../lib/cover'
import type { CoverSelection } from '../lib/cover'
import { manualId } from '../lib/draft'

export interface ManualSave {
	id: string | null
	draft: ManualDraft
	cover: CoverSelection
	// The personal lists a new title goes into; empty for a title that needs none.
	listNames?: string[]
}

export interface ManualSaved {
	mediaRef: string
	coverSaved: boolean
	listSaved: boolean
}

// Saving a hand-made title is two requests: the title, then its cover. The cover
// can only go to a title that exists, so it waits for the first; and a cover
// that fails does not undo a title that was saved — the title is kept, and the
// caller is told the cover did not take.
export const saveManualMediaFx = createEffect(
	async ({ id, draft, cover, listNames }: ManualSave): Promise<ManualSaved> => {
		const saved =
			id === null ? await createManualMediaFx(draft) : await updateManualMediaFx({ id, draft })
		const savedId = id ?? manualId(saved.media.media_ref)
		const mediaRef = saved.media.media_ref

		// Like the cover, a list that does not take leaves the saved title in place.
		let listSaved = true
		if (id === null && listNames && listNames.length > 0) {
			try {
				await updateTrackerEntryFx({
					mediaRef,
					patch: { status: 'PLANNING', custom_lists: listNames }
				})
			} catch {
				listSaved = false
			}
		}

		try {
			if (cover.kind === 'remove') {
				await deleteManualCoverFx(savedId)
			} else {
				const source = coverSource(cover)

				if (source) {
					await setManualCoverFx({ id: savedId, source })
				}
			}

			return { mediaRef, coverSaved: true, listSaved }
		} catch {
			return { mediaRef, coverSaved: false, listSaved }
		}
	}
)

// The title page and the form's own "delete" both remove a hand-made title.
export const manualDeletion = ownRequest(deleteManualMediaMutation)
