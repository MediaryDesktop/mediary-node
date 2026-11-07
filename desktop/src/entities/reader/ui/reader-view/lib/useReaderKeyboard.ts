import { useEffect } from 'react'

// Turning pages from the keyboard, the way a reader expects: arrows and Page
// Up/Down step, Space goes on, Home and End jump to the ends, Escape leaves.
// Shortcuts with a modifier belong to the app and are left alone.
export function useReaderKeyboard({
	current,
	total,
	goTo,
	onEscape
}: {
	current: number
	total: number
	goTo: (index: number) => void
	onEscape: () => void
}): void {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return
			}

			switch (event.key) {
				case 'ArrowRight':
				case 'PageDown':
				case ' ':
					goTo(current + 1)
					break
				case 'ArrowLeft':
				case 'PageUp':
					goTo(current - 1)
					break
				case 'Home':
					goTo(0)
					break
				case 'End':
					goTo(total - 1)
					break
				case 'Escape':
					onEscape()
					break
				default:
					return
			}

			event.preventDefault()
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [current, total, goTo, onEscape])
}
