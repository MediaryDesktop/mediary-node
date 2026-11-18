import type { TFunction } from 'i18next'

export interface PreviewLength {
	reading: boolean
	movie: boolean
	statusLabel: string | null
	seasons: number
	chapters: number | null
	volumes: number | null
	episodes: number | null
	duration: number | null
}

// The line under the title: status, seasons, then how long the title is —
// chapters (or volumes) for what is read, episodes for what is watched (a film
// has none) and how long one of them runs.
export function previewFacts(t: TFunction, title: PreviewLength): string[] {
	const { reading, movie, statusLabel, seasons, chapters, volumes, episodes, duration } = title

	let length: string | null = null
	if (reading) {
		if (chapters) {
			length = t('media.card.chapters', { count: chapters })
		} else if (volumes) {
			length = t('media.card.volumes', { count: volumes })
		}
	} else if (episodes && !movie) {
		length = t('media.card.episodes', { count: episodes })
	}

	return [
		statusLabel,
		seasons > 1 ? t('media.card.seasons', { count: seasons }) : null,
		length,
		!reading && duration ? t('media.card.minutesEach', { count: duration }) : null
	].filter((fact): fact is string => Boolean(fact))
}

// The episode or chapter to go on with: the one after the user's progress,
// never past the last one when the total is known.
export function nextNumber(progress: number, total: number | null | undefined): number {
	return Math.max(1, total ? Math.min(progress + 1, total) : progress + 1)
}

// What the main button says. A film is opened; a book is read from the next
// chapter once its chapters, or where the user is, are known — opened otherwise.
export function previewAction(
	t: TFunction,
	{ reading, movie, known, next }: { reading: boolean; movie: boolean; known: boolean; next: number }
): string {
	if (reading) {
		return known ? t('media.card.read', { chapter: next }) : t('media.card.open')
	}

	return movie ? t('media.card.open') : t('media.card.play', { episode: next })
}
