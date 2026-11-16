import { createEffect, sample } from 'effector'
import type { Effect, Event, Store } from 'effector'

// What a model does outside the graph each time something happens — a toast,
// a value written to localStorage, a call into the shell.
//
// `.watch` does the same thing and is what effector's docs keep for debugging:
// a watcher runs outside any scope, so a forked scope (a test, a second window)
// cannot replace it, and the graph does not show it. An effect started by
// `sample` runs in the scope that fired the clock and can be given a handler.
export function onEach<T>(
	clock: Event<T> | Effect<T, unknown, unknown> | Store<T>,
	fn: (payload: T) => void
): Effect<T, void> {
	const fx = createEffect(fn)

	sample({ clock: clock as Event<T>, target: fx })

	return fx
}
