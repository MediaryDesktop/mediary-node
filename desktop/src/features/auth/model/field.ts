import { createEvent, createStore } from 'effector'

/**
 * One text input as a store plus its change event.
 *
 * Small enough that a form library would be more machinery than the thing it
 * manages: four fields and a submit is not a use case for a schema resolver.
 */
export function createField(initial = '') {
	const changed = createEvent<string>()
	const $value = createStore(initial).on(changed, (_, value) => value)

	return { changed, $value }
}
