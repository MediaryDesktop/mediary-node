import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export const BOOK_ENTER_MS = 340

export function useBookEntrance(openedAt: number) {
	const [elapsed] = useState(() => performance.now() - openedAt)
	const [entering, setEntering] = useState(elapsed < BOOK_ENTER_MS)

	useEffect(() => {
		if (!entering) {
			return
		}

		const timer = window.setTimeout(() => setEntering(false), BOOK_ENTER_MS - elapsed)

		return () => window.clearTimeout(timer)
	}, [entering, elapsed])

	const style: CSSProperties | undefined = entering ? { animationDelay: `${-elapsed}ms` } : undefined

	return { entering, style }
}
