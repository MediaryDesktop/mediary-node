import { useCallback, useEffect, useState } from 'react'

// The whole document goes fullscreen rather than the player: menus open in a portal
// on <body>, and a fullscreen element hides everything outside it. Leaving the
// player leaves fullscreen too.
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
