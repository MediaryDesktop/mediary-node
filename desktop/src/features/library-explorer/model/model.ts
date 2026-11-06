import { createEvent, createStore } from 'effector'

import { atom } from '@shared/factory'

export const libraryExplorerModel = atom(() => {
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
