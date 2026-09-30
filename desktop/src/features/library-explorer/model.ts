import { createEvent, createStore } from 'effector'

import { atom } from '@shared/factory'

export const libraryExplorerModel = atom(() => {
	const requested = createEvent()
	const closed = createEvent()

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed)

	return { $open, requested, closed }
})
