import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { useTranslation } from '@shared/i18n'
import { toast } from '@shared/ui'

import type { PlaybackStream } from '../../../api/api'
import { formatTimecode } from '../../../lib/timecode'
import type { PlayerSnapshot } from '../../../model/pip'

interface StartPositionOptions {
	videoRef: RefObject<HTMLVideoElement | null>
	stream: PlaybackStream
	startAt?: PlayerSnapshot | null
	onStartApplied?: () => void
}

// Where the video starts, once, as soon as it knows its length: the snapshot
// it was handed (the pinned window, the mini player), or else where the user
// stopped last time — then a toast offers to start over instead.
export function useStartPosition({ videoRef, stream, startAt, onStartApplied }: StartPositionOptions) {
	const { t } = useTranslation()

	const resumed = !startAt && stream.resume_at > 0
	const startAtRef = useRef(resumed ? { position: stream.resume_at, playing: true } : startAt)
	const resumedRef = useRef(
		resumed
			? {
					id: `playback-resumed-${stream.file_id}`,
					message: t('playback.resumed', { time: formatTimecode(stream.resume_at) }),
					fromStart: t('playback.fromStart')
				}
			: null
	)
	const onStartAppliedRef = useRef(onStartApplied)

	useEffect(() => {
		const video = videoRef.current
		const start = startAtRef.current

		if (!video || !start) {
			return
		}

		const apply = () => {
			video.currentTime = start.position

			if (!start.playing) {
				video.pause()
			}

			const notice = resumedRef.current
			if (notice) {
				toast(notice.message, {
					id: notice.id,
					action: {
						label: notice.fromStart,
						onClick: () => {
							video.currentTime = 0
						}
					}
				})
			}

			onStartAppliedRef.current?.()
		}

		if (video.readyState >= 1) {
			apply()

			return
		}

		video.addEventListener('loadedmetadata', apply, { once: true })

		return () => video.removeEventListener('loadedmetadata', apply)
	}, [videoRef])
}
