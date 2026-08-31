import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { nodeBridgeMounted, subscribeToNodeState } from '@core/node'

import { AppProviders } from './providers'
import { router } from './router'

/**
 * The composition root — the only place allowed to know every module.
 * Cross-module wiring belongs in providers/wiring, never inside a module
 * (docs/architecture.md §4).
 */
export function App() {
	// Started here, not in a module: it's the app's connection to its own
	// shell, and every module depends on it being live first.
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
