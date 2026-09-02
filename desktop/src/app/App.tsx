import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import { AppProviders } from './providers'
import { router } from './router'

export function App() {
	useEffect(() => {
		const unsubscribe = subscribeToNodeState()
		nodeBridgeMounted()

		return unsubscribe
	}, [])

	return (
		<AppProviders>
			<RouterProvider router={router} />
		</AppProviders>
	)
}
