import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { playerOpened } from '@entities/playback'

// A watch link only asks for the player: it opens over the home page, which is where
// the player is shown from anyway. The player itself is mounted at the app root.
export function WatchPage({ fileId }: { fileId: number }) {
	const open = useUnit(playerOpened)
	const navigate = useNavigate()

	useEffect(() => {
		open(fileId)
		void navigate({ to: '/', replace: true })
	}, [fileId, open, navigate])

	return null
}
