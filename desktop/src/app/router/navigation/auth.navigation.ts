import type { NavigateOptions } from '@tanstack/react-router'
import { createEffect, sample } from 'effector'

import { $returnAfterAuth, landingRoute, returnAfterAuthConsumed, sessionModel } from '@entities/session'
import type { ReturnTarget } from '@entities/session'

import { passwordResetCompleted, passwordResetSent } from '@features/auth'

import { router } from '../router'

const navigateFx = createEffect((options: NavigateOptions) => {
	void router.navigate(options)
})

sample({
	clock: sessionModel.authenticated,
	source: $returnAfterAuth,
	fn: (returnTo, account): NavigateOptions =>
		account.email_verified && returnTo ? toOptions(returnTo) : { to: landingRoute(account) },
	target: navigateFx
})

sample({
	clock: sessionModel.emailVerified,
	source: $returnAfterAuth,
	fn: (returnTo): NavigateOptions => (returnTo ? toOptions(returnTo) : { to: '/' }),
	target: navigateFx
})

sample({
	clock: [sessionModel.emailVerified, sessionModel.signedOut],
	target: returnAfterAuthConsumed
})

sample({
	clock: sessionModel.authenticated,
	filter: account => account.email_verified,
	target: returnAfterAuthConsumed
})

function toOptions(target: ReturnTarget): NavigateOptions {
	return { to: target.to, search: target.search } as NavigateOptions
}

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
