const cache = new Map<() => unknown, unknown>()

export const atom = <T>(factory: () => T): T => {
	if (!cache.has(factory)) {
		cache.set(factory, factory())
	}

	return cache.get(factory) as T
}
