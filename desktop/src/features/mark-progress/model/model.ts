import { createEvent, sample } from 'effector'

import { setChapterReadMutation, setEpisodeWatchedMutation } from '@entities/progress'
import { updateTrackerEntryMutation } from '@entities/tracker'
import type { TrackerEntryPatch } from '@entities/tracker'

import { readProgressPatch } from '../lib/chapters'
import { watchedProgressPatch } from '../lib/episodes'

// Where the user's list stands for the title, at the moment of the mark.
interface ListState {
	progress: number
	listed: boolean
}

export interface EpisodeMark extends ListState {
	mediaRef: string
	episode: number
	watched: boolean
}

export interface ChapterMark extends ListState {
	mediaRef: string
	// Null for an extra the source gave no number; it moves nothing.
	chapter: string | null
	read: boolean
}

export const episodeMarked = createEvent<EpisodeMark>()
export const chapterMarked = createEvent<ChapterMark>()

// A mark is two records: the node's own per-episode state, and the progress
// number of the user's list. They are written side by side, not one after the
// other — the list lives on a tracker that can be offline while the node is
// not, and a list that did not take is no reason to lose the mark.
sample({
	clock: episodeMarked,
	fn: ({ mediaRef, episode, watched }) => ({ mediaRef, episode, watched }),
	target: setEpisodeWatchedMutation.start
})

sample({
	clock: chapterMarked.filterMap(({ mediaRef, chapter, read }) =>
		chapter === null ? undefined : { mediaRef, chapter, read }
	),
	target: setChapterReadMutation.start
})

function listPatch(mediaRef: string, patch: TrackerEntryPatch | null) {
	return patch ? { mediaRef, patch } : null
}

const episodeListPatch = episodeMarked.map(mark =>
	listPatch(mark.mediaRef, watchedProgressPatch(mark.episode, mark.watched, mark))
)

const chapterListPatch = chapterMarked.map(mark =>
	listPatch(mark.mediaRef, readProgressPatch(mark.chapter, mark.read, mark))
)

sample({
	clock: [episodeListPatch, chapterListPatch],
	filter: Boolean,
	target: updateTrackerEntryMutation.start
})
