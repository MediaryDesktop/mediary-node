import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { $playerOpenedAt } from '../../../model/player-session'

export const PLAYER_ENTER_MS = 340

// The slide up a surface plays when it mounts, picked up where the player's opening
// has got to: a negative delay starts the animation part of the way through. A
// surface that mounts after the slide is over appears in place.
export function usePlayerEntrance() {
	const openedAt = useUnit($playerOpenedAt)

	const [elapsed] = useState(() => (openedAt === null ? Infinity : performance.now() - openedAt))
	const [entering, setEntering] = useState(elapsed < PLAYER_ENTER_MS)

	useEffect(() => {
		if (!entering) {
			return
		}

		const timer = window.setTimeout(() => setEntering(false), PLAYER_ENTER_MS - elapsed)

		return () => window.clearTimeout(timer)
	}, [entering, elapsed])

	const style: CSSProperties | undefined = entering ? { animationDelay: `${-elapsed}ms` } : undefined

	return { entering, style }
}
