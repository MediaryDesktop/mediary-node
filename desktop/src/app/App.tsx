import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ScrollProgress } from '@shared/ui'

import { nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import { subscribeToPip } from '@entities/playback'
import { sessionModel } from '@entities/session'

import { WindowChrome } from './layout/window-chrome/WindowChrome'
import { WindowDragStrip } from './layout/window-drag-strip/WindowDragStrip'
import './model/readiness'
import { AppProviders } from './providers'
import { router } from './router'

export function App() {
	useEffect(() => {
		const unsubscribeNode = subscribeToNodeState()
		const unsubscribePip = subscribeToPip()
		nodeBridgeMounted()
		sessionModel.appStarted()

		return () => {
			unsubscribeNode()
			unsubscribePip()
		}
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
