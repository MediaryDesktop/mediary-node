import { createEvent, createStore, is, sample } from 'effector'
import type { Event, EventCallable, Store } from 'effector'

import { $nodeReady } from './bridge'
import { nodeOnline, nodeStreamResumed } from './events'

interface NodeSignals {
	$ready: Store<boolean>
	cameUp: Event<unknown>
	resumed: Event<unknown>
}

// Query is invariant in its data and error, so a concrete one is not assignable
// to Query<P, unknown, unknown>; this is the shape accepted at the boundary.
export type AnyNodeAsk<Params> =
	{ start: EventCallable<Params>; $data: Store<unknown> } | EventCallable<Params>

function startOf<Params>(target: AnyNodeAsk<Params>): EventCallable<Params> {
	return is.unit(target) ? target : target.start
}

// The one rule for when the renderer asks the node for data a screen needs.
//
// Asked while the node is ready, the question goes out at once. Asked while it is
// still starting or restarting, it waits: a request made then fails, and the
// screen would show that failure as if it were the answer ("no library folders").
// It goes out the moment the node is up. After the node comes back from a
// restart, or the event stream reconnects and may have missed changes, the last
// question asked is asked again, so nothing is left showing what was true before.
export function askWhenReady<Params>(
	target: AnyNodeAsk<Params>,
	{ $ready, cameUp, resumed }: NodeSignals
): EventCallable<Params> {
	const wanted = createEvent<Params>()
	const start = startOf(target)

	const $asked = createStore(false, { serialize: 'ignore' }).on(wanted, () => true)
	const $params = createStore<Params | null>(null, { serialize: 'ignore', skipVoid: false }).on(
		wanted,
		(_, params) => params
	)

	sample({ clock: wanted, filter: $ready, target: start })

	sample({
		clock: [cameUp, resumed],
		source: $params,
		filter: $asked,
		fn: params => params as Params,
		target: start
	})

	return wanted
}

const asked = new WeakMap<object, object>()

// The event that asks for `target` by the rule above, made once per target.
export function whenNodeReady<Params>(target: AnyNodeAsk<Params>): EventCallable<Params> {
	let wanted = asked.get(target) as EventCallable<Params> | undefined

	if (!wanted) {
		wanted = askWhenReady(target, { $ready: $nodeReady, cameUp: nodeOnline, resumed: nodeStreamResumed })
		asked.set(target, wanted)
	}

	return wanted
}
