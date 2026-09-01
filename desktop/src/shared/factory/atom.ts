/**
 * A module-level singleton created on first use.
 *
 * Effector units are values, not classes: a model is a function that creates
 * stores and events and wires them together. `atom` runs that function once and
 * memoises the result, so a model can be *declared* as a factory — everything it
 * owns visible in one scope, nothing leaking out except what it returns — while
 * still behaving as the single instance the application shares.
 *
 * The alternative is a file of loose top-level `createStore` calls, where the
 * boundary of "what belongs to this model" is the file itself and every unit is
 * exportable whether or not it is meant to be.
 *
 * Carried over from the previous client, where it survived two years of use.
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-explicit-any
const cache = new Map<Function, any>()

export const atom = <T>(factory: () => T): T => {
	if (!cache.has(factory)) {
		cache.set(factory, factory())
	}

	return cache.get(factory)!
}
