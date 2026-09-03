import { createEvent } from 'effector'

export const unauthorized = createEvent<{ url: string }>()
