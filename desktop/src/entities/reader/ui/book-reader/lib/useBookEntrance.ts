import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

// How long the open slide plays; the reader's own .enter animations match it.
export const BOOK_ENTER_MS = 340

// The open slide a reader surface plays, picked up from where it was when the page
// first asked to open this book: a negative delay starts the animation part way
// through, so the loading panel and the reader that replaces it continue one slide
// instead of each starting their own and visibly jumping.
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
