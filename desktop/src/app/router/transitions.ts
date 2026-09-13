import type { ParsedLocation } from '@tanstack/react-router'

import { slideTransitionTypes } from '@shared/ui'

interface LocationChange {
	fromLocation?: ParsedLocation
	toLocation: ParsedLocation
	pathChanged: boolean
}

const AUTH_STEPS: Record<string, readonly [depth: number, lane: number]> = {
	'/sign-in': [0, 0],
	'/sign-up': [0, 1],
	'/sign-in/email': [1, 0],
	'/sign-up/email': [1, 1],
	'/reset-password': [2, 0],
	'/verify-email': [2, 0],
	'/new-password': [3, 0]
}

export const authViewTransition = {
	types: ({ fromLocation, toLocation, pathChanged }: LocationChange): string[] | false => {
		const from = fromLocation ? AUTH_STEPS[fromLocation.pathname] : undefined
		const to = AUTH_STEPS[toLocation.pathname]

		if (!pathChanged || !from || !to) {
			return false
		}

		const order = to[0] - from[0] || to[1] - from[1]

		return slideTransitionTypes(order < 0 ? 'back' : 'forward', 'auth')
	}
}
