import { useCallback, useEffect, useRef, useState } from 'react'

const ROTATE_EVERY = 12000
const TRANSITION_HOLD = 900

export interface BannerRotation {
	index: number
	transitioning: boolean
	goTo: (next: number | ((value: number) => number)) => void
	setPaused: (paused: boolean) => void
}

export function useBannerRotation(count: number): BannerRotation {
	const [index, setIndex] = useState(0)
	const [paused, setPaused] = useState(false)
	const [transitioning, setTransitioning] = useState(false)
	const swapTimer = useRef<number | undefined>(undefined)

	const goTo = useCallback((next: number | ((value: number) => number)) => {
		window.clearTimeout(swapTimer.current)
		setTransitioning(true)

		swapTimer.current = window.setTimeout(() => {
			setIndex(next)
			setTransitioning(false)
		}, TRANSITION_HOLD)
	}, [])

	useEffect(() => () => window.clearTimeout(swapTimer.current), [])

	useEffect(() => {
		if (paused || count < 2) {
			return
		}

		const timer = window.setInterval(() => goTo(value => (value + 1) % count), ROTATE_EVERY)

		return () => window.clearInterval(timer)
	}, [paused, count, goTo])

	return { index, transitioning, goTo, setPaused }
}
