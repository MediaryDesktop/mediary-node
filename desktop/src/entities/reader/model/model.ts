import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { fetchBookStateFx, fetchChapterFx, reportReaderPageFx, saveBookPositionFx } from '../api/api'
import type { ReportPageParams } from '../api/api'

export const chapterQuery = createQuery({ effect: fetchChapterFx, name: 'readerChapter' })

export const reportPageMutation = createMutation({ effect: reportReaderPageFx, name: 'reportReaderPage' })

export const bookStateQuery = createQuery({ effect: fetchBookStateFx, name: 'readerBookState' })

concurrency(chapterQuery, { strategy: 'TAKE_LATEST' })
concurrency(bookStateQuery, { strategy: 'TAKE_LATEST' })

export const saveBookPositionMutation = createMutation({
	effect: saveBookPositionFx,
	name: 'saveReaderBookPosition'
})

export const readerModel = atom(() => {
	const pageTurned = createEvent<ReportPageParams>()

	sample({ clock: pageTurned, target: reportPageMutation.start })

	const $counted = createStore(false)
		.on(reportPageMutation.finished.success, (current, { result }) => current || result.counted)
		.reset(chapterQuery.start)

	return { pageTurned, $counted }
})
