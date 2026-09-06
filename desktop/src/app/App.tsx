import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import { sessionModel } from '@entities/session'

import { AppProviders } from './providers'
import { router } from './router'

export function App() {
	useEffect(() => {
		const unsubscribe = subscribeToNodeState()
		nodeBridgeMounted()
		sessionModel.appStarted()

		return unsubscribe
	}, [])

	useEffect(() => sessionModel.signedOut.watch(() => void router.navigate({ to: '/' })), [])

	return (
		<AppProviders>
			<RouterProvider router={router} />
		</AppProviders>
	)
}
