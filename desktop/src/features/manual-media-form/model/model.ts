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

import { coverSource } from '../lib/cover'
import type { CoverSelection } from '../lib/cover'
import { manualId } from '../lib/draft'

export interface ManualSave {
	id: string | null
	draft: ManualDraft
	cover: CoverSelection
}

export interface ManualSaved {
	mediaRef: string
	coverSaved: boolean
}

// Saving a hand-made title is two requests: the title, then its cover. The cover
// can only go to a title that exists, so it waits for the first; and a cover
// that fails does not undo a title that was saved — the title is kept, and the
// caller is told the cover did not take.
export const saveManualMediaFx = createEffect(
	async ({ id, draft, cover }: ManualSave): Promise<ManualSaved> => {
		const saved =
			id === null ? await createManualMediaFx(draft) : await updateManualMediaFx({ id, draft })
		const savedId = id ?? manualId(saved.media.media_ref)

		try {
			if (cover.kind === 'remove') {
				await deleteManualCoverFx(savedId)
			} else {
				const source = coverSource(cover)

				if (source) {
					await setManualCoverFx({ id: savedId, source })
				}
			}

			return { mediaRef: saved.media.media_ref, coverSaved: true }
		} catch {
			return { mediaRef: saved.media.media_ref, coverSaved: false }
		}
	}
)

// The title page and the form's own "delete" both remove a hand-made title.
export const manualDeletion = ownRequest(deleteManualMediaMutation)
