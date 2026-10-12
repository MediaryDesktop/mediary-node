import { useCallback, useEffect, useRef, useState } from 'react'

// Long enough to read the synopsis, short enough that the banner feels alive.
const ROTATE_EVERY = 12000
// How long the banner stays veiled while the next title swaps in behind it.
const TRANSITION_HOLD = 900

export interface BannerRotation {
	index: number
	// True for the TRANSITION_HOLD stretch between asking for the next title and it
	// actually taking over: the backdrop darkens and holds still, hiding the swap
	// underneath, then lifts again once it has already happened.
	transitioning: boolean
	goTo: (next: number | ((value: number) => number)) => void
	setPaused: (paused: boolean) => void
}

// Moves on to the next of `count` titles by itself until paused.
export function useBannerRotation(count: number): BannerRotation {
	const [index, setIndex] = useState(0)
	const [paused, setPaused] = useState(false)
	const [transitioning, setTransitioning] = useState(false)
	const swapTimer = useRef<number | undefined>(undefined)

	// Jumps straight to a title the TRANSITION_HOLD stretch later, veiled the
	// whole way; a jump already in flight is replaced rather than queued.
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
