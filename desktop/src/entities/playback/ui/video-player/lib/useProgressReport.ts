import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'

import { playbackModel } from '../../../model/model'

const PROGRESS_INTERVAL = 10_000

export interface ProgressReportOptions {
	videoRef: RefObject<HTMLVideoElement | null>
	fileId: number
	// What the probe found; 0 when it could not tell.
	probedDuration: number
	playing: boolean
}

// Tells the node how far the user got: every few seconds while playing, and when the
// player goes away. Returns the reporter for pause and end.
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
			// A transcode's playlist grows while it is read, so the element's own
			// duration is only right once it ends; the probe knew it from the start.
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
