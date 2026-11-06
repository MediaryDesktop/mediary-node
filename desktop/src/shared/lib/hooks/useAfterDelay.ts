import { useEffect, useRef } from 'react'

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
