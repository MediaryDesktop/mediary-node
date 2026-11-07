import { combine, createEvent, createStore, sample } from 'effector'
import type { Event, EventCallable } from 'effector'

import type { MutationLike } from './record-editor'

// One sender's view of a mutation that others may also start.
//
// A mutation's finished events fire for every caller, so a form that watches them
// takes another form's save, or an older check, for its own. `sent` starts the
// mutation and remembers that request; `succeeded` and `failed` fire only for
// the answer to it. `forgotten` drops the request — say, when the fields it was
// about have changed — so a late answer to it is ignored too.
export function ownRequest<Params, Result>(mutation: MutationLike<Params, Result>) {
	const sent = createEvent<Params>()
	const forgotten = createEvent()

	const $last = createStore<{ params: Params } | null>(null)
		.on(sent, (_, params) => ({ params }))
		.reset(forgotten)

	sample({ clock: sent as Event<unknown>, target: mutation.start as EventCallable<unknown> })

	const succeeded = sample({
		clock: mutation.finished.success,
		source: $last,
		filter: (last, { params }) => last !== null && last.params === params,
		fn: (_, done) => done
	})

	const failed = sample({
		clock: mutation.finished.failure,
		source: $last,
		filter: (last, { params }) => last !== null && last.params === params,
		fn: (_, done) => done
	})

	$last.reset(succeeded, failed)

	const $pending = combine(mutation.$pending, $last, (pending, last) => pending && last !== null)

	const $params = $last.map(last => (last === null ? null : last.params))

	return { sent, forgotten, succeeded, failed, $pending, $params }
}

export type OwnRequest<Params, Result> = ReturnType<typeof ownRequest<Params, Result>>
