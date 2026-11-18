import { firstPresent } from '@shared/lib'

import type { TrackerTitle } from '../api/api'

export function formatProgress(progress: number, total: number | null | undefined): string {
	return total ? `${progress} / ${total}` : String(progress)
}

export function preferredTitle(title: TrackerTitle): string {
	return firstPresent(title.user_preferred, title.english, title.romaji, title.native)
}
