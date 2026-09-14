import { redirect } from '@tanstack/react-router'

import { landingRoute, resolveSession } from '@entities/session'

export async function requireGuest() {
	const { account, linked } = await resolveSession()

	if (linked && account) {
		throw redirect({ to: landingRoute(account) })
	}
}

export async function requireUnverifiedAccount() {
	const { account, linked } = await resolveSession()

	if (!account || !linked) {
		throw redirect({ to: '/sign-in' })
	}

	if (account.email_verified) {
		throw redirect({ to: '/' })
	}
}
