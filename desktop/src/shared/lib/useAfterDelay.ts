import { useEffect, useRef } from 'react'

// Calls the callback once the given time has passed since `active` turned on — e.g.
// to unmount a view after its leave animation. Turning it off again cancels the call.
export function useAfterDelay(active: boolean, delayMs: number, callback: () => void): void {
	const latest = useRef(callback)

	useEffect(() => {
		latest.current = callback
	})

	useEffect(() => {
		if (!active) {
			return
		}

		const timer = window.setTimeout(() => latest.current(), delayMs)

		return () => window.clearTimeout(timer)
	}, [active, delayMs])
}
