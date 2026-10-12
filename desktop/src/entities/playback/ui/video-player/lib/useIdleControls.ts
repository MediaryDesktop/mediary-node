import { useCallback, useEffect, useState } from 'react'

// Ten seconds without the pointer or a key, and the controls leave; they come back on
// the next movement. Playback itself does not count as activity.
const CONTROLS_HIDE_DELAY = 10_000

export function useIdleControls(playing: boolean): { controlsVisible: boolean; wake: () => void } {
	const [controlsVisible, setControlsVisible] = useState(true)
	const [activity, setActivity] = useState(0)

	const wake = useCallback(() => {
		setControlsVisible(true)
		setActivity(count => count + 1)
	}, [])

	// Keyed on activity, not on playback: the position changes several times a second
	// while the film plays, and restarting the timer on each of them would never let
	// the controls go.
	useEffect(() => {
		if (!controlsVisible || !playing) {
			return
		}

		const timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY)

		return () => window.clearTimeout(timer)
	}, [controlsVisible, playing, activity])

	return { controlsVisible, wake }
}
