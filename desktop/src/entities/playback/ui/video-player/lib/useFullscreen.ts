import { useCallback, useEffect, useState } from 'react'

export function useFullscreen(): { fullscreen: boolean; toggleFullscreen: () => void } {
	const [fullscreen, setFullscreen] = useState(false)

	useEffect(() => {
		const onChange = () => setFullscreen(document.fullscreenElement !== null)

		document.addEventListener('fullscreenchange', onChange)

		return () => {
			document.removeEventListener('fullscreenchange', onChange)
			if (document.fullscreenElement) {
				void document.exitFullscreen()
			}
		}
	}, [])

	const toggleFullscreen = useCallback(() => {
		if (document.fullscreenElement) {
			void document.exitFullscreen()
		} else {
			void document.documentElement.requestFullscreen()
		}
	}, [])

	return { fullscreen, toggleFullscreen }
}
