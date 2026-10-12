import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { videoFit } from '../../../lib/fit'

// How the picture fits the player as the player resizes: cropped to fill when the
// proportions nearly match, letterboxed otherwise.
export function useStageFit(
	stageRef: RefObject<HTMLElement | null>,
	videoAspect: number | null
): 'cover' | 'contain' {
	const [stageAspect, setStageAspect] = useState(0)

	useEffect(() => {
		const stage = stageRef.current
		if (!stage) {
			return
		}

		const measure = () => {
			const { width, height } = stage.getBoundingClientRect()
			setStageAspect(height > 0 ? width / height : 0)
		}

		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(stage)

		return () => observer.disconnect()
	}, [stageRef])

	return videoAspect ? videoFit(stageAspect, videoAspect) : 'contain'
}
