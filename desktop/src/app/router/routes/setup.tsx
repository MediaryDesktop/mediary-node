import { createRoute } from '@tanstack/react-router'

import { SetupPage } from '@pages/setup'

import { rootRoute } from './root'

export const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/setup',
	component: SetupPage
})
