import { createEvent, createStore } from 'effector'

import { atom } from '@shared/factory'

export const libraryExplorerModel = atom(() => {
	// A folder to open at, when the explorer is asked from a place that already
	// knows which one — a scan summary pointing at the files it logged.
	const requested = createEvent<string | void>()
	const closed = createEvent()
	const searchChanged = createEvent<string>()

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed)

	const $search = createStore('')
		.on(requested, (_, folder) => folder ?? '')
		.on(searchChanged, (_, search) => search)

	return { $open, $search, requested, closed, searchChanged }
})
