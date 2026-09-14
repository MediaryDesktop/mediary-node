import type { NavigateOptions } from '@tanstack/react-router'
import { createEffect, sample } from 'effector'

import { landingRoute, sessionModel } from '@entities/session'

import { passwordResetCompleted, passwordResetSent } from '@features/auth'

import { router } from '../router'

const navigateFx = createEffect((options: NavigateOptions) => {
	void router.navigate(options)
})

sample({
	clock: sessionModel.authenticated,
	fn: (account): NavigateOptions => ({ to: landingRoute(account) }),
	target: navigateFx
})

sample({
	clock: sessionModel.emailVerified,
	fn: (): NavigateOptions => ({ to: '/' }),
	target: navigateFx
})

sample({
	clock: sessionModel.signedOut,
	fn: (): NavigateOptions => ({ to: '/' }),
	target: navigateFx
})

sample({
	clock: passwordResetSent,
	fn: (email): NavigateOptions => ({ to: '/new-password', search: { email } }),
	target: navigateFx
})

sample({
	clock: passwordResetCompleted,
	fn: (): NavigateOptions => ({ to: '/sign-in/email' }),
	target: navigateFx
})
