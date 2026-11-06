import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { $playerOpenedAt } from '../../../model/player-session'

export const PLAYER_ENTER_MS = 340

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
