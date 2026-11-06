import { useMemo } from 'react'
import type { RefObject } from 'react'

export interface VideoActions {
	togglePlay: () => void
	seekBy: (delta: number) => void
	seekTo: (position: number) => void
	changeVolume: (next: number) => void
	toggleMute: () => void
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

function togglePlay(video: HTMLVideoElement): void {
	if (video.paused) {
		void video.play()
	} else {
		video.pause()
	}
}

function changeVolume(video: HTMLVideoElement, next: number): void {
	video.volume = clamp(next, 0, 1)
	video.muted = video.volume === 0
}

export function useVideoActions(
	videoRef: RefObject<HTMLVideoElement | null>,
	onSeek?: (position: number) => void
): VideoActions {
	return useMemo(
		() => ({
			togglePlay: () => {
				const video = videoRef.current
				if (video) togglePlay(video)
			},
			seekBy: delta => {
				const video = videoRef.current
				if (!video) return
				const next = clamp(video.currentTime + delta, 0, video.duration || 0)
				video.currentTime = next
				onSeek?.(next)
			},
			seekTo: position => {
				const video = videoRef.current
				if (!video) return
				video.currentTime = position
				onSeek?.(position)
			},
			changeVolume: next => {
				const video = videoRef.current
				if (video) changeVolume(video, next)
			},
			toggleMute: () => {
				const video = videoRef.current
				if (video) video.muted = !video.muted
			}
		}),
		[videoRef, onSeek]
	)
}
