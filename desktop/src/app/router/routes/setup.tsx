import { createRoute } from '@tanstack/react-router'

import { SetupPage } from '@pages/setup'

import { rootRoute } from './root'

export const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/setup',
	validateSearch: (search: Record<string, unknown>): { step?: string } =>
		typeof search.step === 'string' ? { step: search.step } : {},
	component: () => <SetupPage initialStep={setupRoute.useSearch().step} />
})
