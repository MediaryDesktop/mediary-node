import { createRoute } from '@tanstack/react-router'

import { SetupPage } from '@pages/setup'

import { rootRoute } from './root'

export const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/setup',
	// Lets a flow that left the wizard — signing in from its account step —
	// come back to the step it left from.
	validateSearch: (search: Record<string, unknown>): { step?: string } =>
		typeof search.step === 'string' ? { step: search.step } : {},
	component: () => <SetupPage initialStep={setupRoute.useSearch().step} />
})
