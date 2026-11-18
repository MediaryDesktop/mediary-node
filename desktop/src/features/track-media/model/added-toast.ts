import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { isLocalTrackerType } from '@entities/tracker'
import type { TrackerMediaType } from '@entities/tracker'

// A title saved from a drawer while it was on no list yet is added there by
// the node — to AniList for anime and manga, to the node's own list otherwise.
// One id for every drawer, so a save heard by two of them shows one toast.
export function announceAdded({ mediaType, title }: { mediaType: TrackerMediaType; title: string }): void {
	const key = isLocalTrackerType(mediaType) ? 'lists.addEntry.doneLocal' : 'lists.addEntry.done'

	toast.success(translate(key, { title }), { id: 'tracker-entry-added' })
}
