import { createMutation, createQuery } from '@farfetched/core'
import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { fetchChapterFx, reportReaderPageFx } from '../api/api'
import type { ReportPageParams } from '../api/api'

export const chapterQuery = createQuery({ effect: fetchChapterFx, name: 'readerChapter' })

export const reportPageMutation = createMutation({ effect: reportReaderPageFx, name: 'reportReaderPage' })

export const readerModel = atom(() => {
	const pageTurned = createEvent<ReportPageParams>()

	// The node decides when a chapter counts; the reader only says where it is.
	sample({ clock: pageTurned, target: reportPageMutation.start })

	// Set once the node has counted the chapter as read, so the reader can say so.
	const $counted = createStore(false)
		.on(reportPageMutation.finished.success, (current, { result }) => current || result.counted)
		.reset(chapterQuery.start)

	return { pageTurned, $counted }
})
