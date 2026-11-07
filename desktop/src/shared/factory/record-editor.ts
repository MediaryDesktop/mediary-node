import { combine, createEvent, createStore, sample } from 'effector'
import type { Event, EventCallable, Store } from 'effector'

import type { RequestFailure } from '../api'

type Failure = RequestFailure['error']

// sample() cannot resolve its target's type while that type is still a generic
// parameter here; the payload is exactly what the target takes, so pass it on as is.
function relay<T>(clock: Event<T>, target: EventCallable<T>): void {
	sample({ clock: clock as Event<unknown>, target: target as EventCallable<unknown> })
}

// The shape of a Farfetched mutation this needs, without tying it to one: a
// concrete Mutation is invariant in its types, so it would not be assignable to
// Mutation<P, unknown, unknown>.
export interface MutationLike<Params, Result> {
	start: EventCallable<Params>
	$pending: Store<boolean>
	finished: {
		success: Event<{ params: Params; result: Result }>
		failure: Event<{ params: Params; error: Failure }>
	}
}

export interface RecordEditorConfig<
	Item extends { id: Id },
	Id,
	Fields,
	Body,
	CheckParams,
	CheckResult,
	Outcome
> {
	create: MutationLike<Body, unknown>
	update: MutationLike<{ id: Id; body: Body }, unknown>
	check?: MutationLike<CheckParams, CheckResult>

	empty: Fields
	fieldsOf: (item: Item) => Fields
	bodyOf: (fields: Fields, item: Item | null) => Body
	canSubmit: (fields: Fields) => boolean

	checkParamsOf?: (fields: Fields, item: Item | null) => CheckParams
	canCheck?: (fields: Fields) => boolean
	checkSucceeded?: (result: CheckResult) => Outcome
	checkFailed?: (error: Failure) => Outcome
}

export type Editing<Item> = { item: Item | null } | null

// A form that adds a record or edits one, open on at most one record (or on a new
// one) at a time, with its fields, its connection check and its save.
//
// A save or a check belongs to this editor only if it answers the very request
// the editor sent. Another check sent since, a field changed since, or another
// form saving through the same mutation makes an answer someone else's, and it
// is dropped rather than shown against fields it was not about. A component that
// watched the mutation itself could not tell those apart.
export function createRecordEditor<
	Item extends { id: Id },
	Id,
	Fields,
	Body,
	CheckParams,
	CheckResult,
	Outcome
>(config: RecordEditorConfig<Item, Id, Fields, Body, CheckParams, CheckResult, Outcome>) {
	const { create, update, check } = config

	const opened = createEvent<Item | null>()
	const closed = createEvent()
	const changed = createEvent<Partial<Fields>>()
	const checked = createEvent()
	const submitted = createEvent()

	const $editing = createStore<Editing<Item>>(null)
		.on(opened, (_, item) => ({ item }))
		.reset(closed)

	const $fields = createStore<Fields>(config.empty)
		.on(opened, (_, item) => (item ? config.fieldsOf(item) : config.empty))
		.on(changed, (fields, patch) => ({ ...fields, ...patch }))

	const $item = $editing.map(editing => editing?.item ?? null)

	const $check = createStore<Outcome | null>(null).reset(opened, changed, closed)

	if (check && config.checkParamsOf) {
		const paramsOf = config.checkParamsOf
		const canCheck = config.canCheck ?? (() => true)

		const checkSent = sample({
			clock: checked,
			source: { fields: $fields, item: $item },
			filter: ({ fields }) => canCheck(fields),
			fn: ({ fields, item }) => paramsOf(fields, item)
		})

		const $sentCheck = createStore<CheckParams | null>(null)
			.on(checkSent, (_, params) => params)
			.reset(opened, changed, closed)

		$check.on(checkSent, () => null)

		relay(checkSent, check.start)

		sample({
			clock: check.finished.success,
			source: $sentCheck,
			filter: (sent, { params }) => sent === params,
			fn: (_, { result }) =>
				config.checkSucceeded ? config.checkSucceeded(result) : (result as unknown as Outcome),
			target: $check
		})

		if (config.checkFailed) {
			const failed = config.checkFailed

			sample({
				clock: check.finished.failure,
				source: $sentCheck,
				filter: (sent, { params }) => sent === params,
				fn: (_, { error }) => failed(error),
				target: $check
			})
		}
	}

	const $canSubmit = $fields.map(config.canSubmit)

	const ready = sample({
		clock: submitted,
		source: { fields: $fields, item: $item, can: $canSubmit },
		filter: ({ can }) => can
	})

	const createSent = sample({
		clock: ready,
		filter: ({ item }) => item === null,
		fn: ({ fields }) => config.bodyOf(fields, null)
	})

	const updateSent = sample({
		clock: ready,
		filter: ({ item }) => item !== null,
		fn: ({ fields, item }) => ({ id: (item as Item).id, body: config.bodyOf(fields, item) })
	})

	const $sentSave = createStore<unknown>(null)
		.on(createSent, (_, params) => params)
		.on(updateSent, (_, params) => params)
		.reset(opened, closed)

	relay(createSent, create.start)
	relay(updateSent, update.start)

	const mine = <Payload extends { params: unknown }>(clock: Event<Payload>) =>
		sample({
			clock,
			source: $sentSave,
			filter: (sent, { params }) => sent !== null && sent === params,
			fn: (_, payload) => payload
		})

	const saved = createEvent()
	const saveFailed = createEvent<Failure>()

	sample({
		clock: [mine(create.finished.success), mine(update.finished.success)],
		fn: () => undefined,
		target: [saved, closed]
	})

	sample({
		clock: [mine(create.finished.failure), mine(update.finished.failure)],
		fn: ({ error }) => error,
		target: saveFailed
	})

	const $submitting = combine(
		create.$pending,
		update.$pending,
		$sentSave,
		(creating, updating, sent) => (creating || updating) && sent !== null
	)

	const $checking = check ? check.$pending : createStore(false)

	return {
		$editing,
		$fields,
		$check,
		$checking,
		$canSubmit,
		$submitting,
		opened,
		closed,
		changed,
		checked,
		submitted,
		saved,
		saveFailed
	}
}
