import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ScrollProgress } from '@shared/ui'

import { nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import { sessionModel } from '@entities/session'

import { WindowChrome } from './layout/window-chrome/WindowChrome'
import { WindowDragStrip } from './layout/window-drag-strip/WindowDragStrip'
import { AppProviders } from './providers'
import { router } from './router'

export function App() {
	useEffect(() => {
		const unsubscribe = subscribeToNodeState()
		nodeBridgeMounted()
		sessionModel.appStarted()

		return unsubscribe
	}, [])

	return (
		<AppProviders>
			<WindowDragStrip />
			<RouterProvider router={router} />
			<WindowChrome />
			<ScrollProgress />
		</AppProviders>
	)
}
