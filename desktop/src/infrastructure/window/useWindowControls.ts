import { useEffect, useState } from 'react'

export interface WindowControlsState {
	maximized: boolean
	onMinimize: () => void
	onToggleMaximize: () => void
	onClose: () => void
}

// The app's own window, as the shell exposes it: whether it is maximised, and
// the three buttons a frameless window has to draw for itself.
export function useWindowControls(): WindowControlsState {
	const [maximized, setMaximized] = useState(false)

	useEffect(() => {
		let cancelled = false

		void window.mediary.window.isMaximized().then(value => {
			if (!cancelled) {
				setMaximized(value)
			}
		})

		const unsubscribe = window.mediary.window.onMaximizedChange(setMaximized)

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [])

	return {
		maximized,
		onMinimize: () => void window.mediary.window.minimize(),
		onToggleMaximize: () => void window.mediary.window.toggleMaximize(),
		onClose: () => void window.mediary.window.close()
	}
}
