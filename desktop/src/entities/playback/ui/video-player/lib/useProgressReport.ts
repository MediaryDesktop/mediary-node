import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'

import { playbackModel } from '../../../model/model'

const PROGRESS_INTERVAL = 10_000

export interface ProgressReportOptions {
	videoRef: RefObject<HTMLVideoElement | null>
	fileId: number
	probedDuration: number
	playing: boolean
}

export function useProgressReport({
	videoRef,
	fileId,
	probedDuration,
	playing
}: ProgressReportOptions): (ended?: boolean) => void {
	const reportProgress = useUnit(playbackModel.progressReported)

	const report = useCallback(
		(ended = false) => {
			const video = videoRef.current
			const total = probedDuration > 0 ? probedDuration : video?.duration
			if (!video || !total || !Number.isFinite(total)) {
				return
			}

			reportProgress({ fileId, position: video.currentTime, duration: total, ended })
		},
		[videoRef, fileId, probedDuration, reportProgress]
	)

	useEffect(() => {
		if (!playing) {
			return
		}

		const timer = window.setInterval(() => report(), PROGRESS_INTERVAL)

		return () => window.clearInterval(timer)
	}, [playing, report])

	useEffect(() => () => report(), [report])

	return report
}
