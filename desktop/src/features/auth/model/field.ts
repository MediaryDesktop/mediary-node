import { createEvent, createStore } from 'effector'

export function createField(initial = '') {
	const changed = createEvent<string>()
	const $value = createStore(initial).on(changed, (_, value) => value)

	return { changed, $value }
}
