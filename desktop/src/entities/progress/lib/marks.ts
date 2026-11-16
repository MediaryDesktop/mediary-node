import type { TitleProgress } from '../api/api'

// What the title page marks on each episode and chapter, read out of the node's
// state for one title.
export interface TitleMarks {
	// Episodes watched through or marked so, by number across seasons.
	watched: ReadonlySet<number>
	// How far into each begun and unfinished episode the user is, from 0 to 1.
	started: ReadonlyMap<number, number>
	// Chapters read to the end or marked so, by number.
	read: ReadonlySet<number>
}

export const NO_MARKS: TitleMarks = { watched: new Set(), started: new Map(), read: new Set() }

// A state of another title — the query still answering for the previous page —
// marks nothing.
export function titleMarks(progress: TitleProgress | null | undefined, mediaRef: string): TitleMarks {
	if (!progress || progress.media_ref !== mediaRef) {
		return NO_MARKS
	}

	const watched = new Set<number>()
	const started = new Map<number, number>()
	const read = new Set<number>()

	for (const episode of progress.episodes ?? []) {
		if (episode.watched) {
			watched.add(episode.episode)
		} else if (episode.position > 0 && episode.duration > 0) {
			started.set(episode.episode, Math.min(episode.position / episode.duration, 1))
		}
	}

	for (const chapter of progress.chapters ?? []) {
		const number = Number.parseFloat(chapter.chapter)

		if (chapter.read && Number.isFinite(number)) {
			read.add(number)
		}
	}

	return { watched, started, read }
}
