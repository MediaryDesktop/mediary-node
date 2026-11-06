import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { videoFit } from '../../../lib/fit'

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
