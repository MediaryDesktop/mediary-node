import { createWatch } from 'effector'
import type { Unit } from 'effector'
import { useEffect, useRef } from 'react'

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
