import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import type { VideoActions } from './useVideoActions'

const SEEK_STEP = 5
const VOLUME_STEP = 0.05

export interface PlayerKeyboardOptions {
	enabled: boolean
	videoRef: RefObject<HTMLVideoElement | null>
	actions: VideoActions
	onActivity: () => void
	onToggleFullscreen: () => void
	onMinimize: () => void
}

export function usePlayerKeyboard(options: PlayerKeyboardOptions): void {
	const latest = useRef(options)

	useEffect(() => {
		latest.current = options
	})

	const { enabled } = options

	useEffect(() => {
		if (!enabled) {
			return
		}

		const onKey = (event: KeyboardEvent) => {
			const onRangeInput = event.target instanceof HTMLInputElement && event.target.type === 'range'

			if (
				(event.target instanceof HTMLInputElement && !onRangeInput) ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey
			) {
				return
			}

			const { videoRef, actions, onActivity, onToggleFullscreen, onMinimize } = latest.current
			const volume = videoRef.current?.volume ?? 1

			onActivity()

			switch (event.key) {
				case ' ':
				case 'k':
					actions.togglePlay()
					break
				case 'ArrowLeft':
					actions.seekBy(-SEEK_STEP)
					break
				case 'ArrowRight':
					actions.seekBy(SEEK_STEP)
					break
				case 'ArrowUp':
					actions.changeVolume(volume + VOLUME_STEP)
					break
				case 'ArrowDown':
					actions.changeVolume(volume - VOLUME_STEP)
					break
				case 'm':
					actions.toggleMute()
					break
				case 'f':
					onToggleFullscreen()
					break
				case 'Escape':
					if (!document.fullscreenElement) onMinimize()
					break
				default:
					return
			}

			event.preventDefault()
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [enabled])
}
