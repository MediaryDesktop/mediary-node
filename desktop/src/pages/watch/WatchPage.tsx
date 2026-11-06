import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { playerOpened } from '@entities/playback'

export function WatchPage({ fileId }: { fileId: number }) {
	const open = useUnit(playerOpened)
	const navigate = useNavigate()

	useEffect(() => {
		open(fileId)
		void navigate({ to: '/', replace: true })
	}, [fileId, open, navigate])

	return null
}
