import { createWatch } from 'effector'
import type { Unit } from 'effector'
import { useEffect, useRef } from 'react'

// Calls the handler on every update of the unit while the component is mounted.
// The handler is read fresh on each call, so it may close over props and state
// without a dependency list.
export function useUnitWatch<T>(unit: Unit<T>, handler: (payload: T) => void): void {
	const latest = useRef(handler)

	useEffect(() => {
		latest.current = handler
	})

	useEffect(() => {
		const subscription = createWatch({ unit, fn: payload => latest.current(payload) })

		return () => subscription.unsubscribe()
	}, [unit])
}
