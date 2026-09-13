import { flushSync } from 'react-dom'

export const SLIDE_FRAME_CLASS = 'slide-frame'
export const SLIDE_CONTENT_CLASS = 'slide-content'

export type SlideDirection = 'forward' | 'back'

export function slideTransitionTypes(direction: SlideDirection, scope?: string): string[] {
	const types = ['slide', `slide-${direction}`]

	return scope ? [...types, scope] : types
}

export function startSlideTransition(direction: SlideDirection, update: () => void, scope?: string) {
	if (typeof document.startViewTransition !== 'function') {
		update()
		return
	}

	document.startViewTransition({
		update: () => flushSync(update),
		types: slideTransitionTypes(direction, scope)
	})
}
