import { useCallback, useEffect, useState } from 'react'

const CONTROLS_HIDE_DELAY = 10_000

export function useIdleControls(playing: boolean): { controlsVisible: boolean; wake: () => void } {
	const [controlsVisible, setControlsVisible] = useState(true)
	const [activity, setActivity] = useState(0)

	const wake = useCallback(() => {
		setControlsVisible(true)
		setActivity(count => count + 1)
	}, [])

	useEffect(() => {
		if (!controlsVisible || !playing) {
			return
		}

		const timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY)

		return () => window.clearTimeout(timer)
	}, [controlsVisible, playing, activity])

	return { controlsVisible, wake }
}
