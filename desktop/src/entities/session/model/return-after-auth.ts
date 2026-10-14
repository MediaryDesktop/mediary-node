import { createEvent, createStore } from 'effector'

export interface ReturnTarget {
	to: string
	search?: Record<string, string>
}

// Signing in always lands on the home page, which is right from the sign-in
// screen and wrong from inside the setup wizard or the backup settings: the
// user went to sign in to finish what they were doing there.
export const returnAfterAuthRequested = createEvent<ReturnTarget>()
export const returnAfterAuthConsumed = createEvent()

export const $returnAfterAuth = createStore<ReturnTarget | null>(null)
	.on(returnAfterAuthRequested, (_, target) => target)
	.reset(returnAfterAuthConsumed)
