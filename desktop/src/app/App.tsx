import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ScrollProgress } from '@shared/ui'

import { nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import { sessionModel } from '@entities/session'

import { WindowChrome } from './layout/window-chrome/WindowChrome'
import { WindowDragStrip } from './layout/window-drag-strip/WindowDragStrip'
import './model/readiness'
import { AppProviders } from './providers'
import { router } from './router'

// The splash itself lives in a separate, main-process-owned window (see
// electron/main/splash.ts) rather than inside this one — importing
// './model/readiness' just for its side effect is what tells that window
// when to hand off.
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
