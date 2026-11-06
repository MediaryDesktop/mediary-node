import { createEvent, createStore } from 'effector'

export interface ReturnTarget {
	to: string
	search?: Record<string, string>
}

export const returnAfterAuthRequested = createEvent<ReturnTarget>()
export const returnAfterAuthConsumed = createEvent()

export const $returnAfterAuth = createStore<ReturnTarget | null>(null)
	.on(returnAfterAuthRequested, (_, target) => target)
	.reset(returnAfterAuthConsumed)
