import type { Ref } from 'react'

// Combines several refs into one callback ref, so a component can keep its own
// (e.g. for the ripple) while still forwarding the caller's.
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
	return (node: T | null) => {
		for (const ref of refs) {
			if (typeof ref === 'function') {
				ref(node)
			} else if (ref) {
				;(ref as { current: T | null }).current = node
			}
		}
	}
}
