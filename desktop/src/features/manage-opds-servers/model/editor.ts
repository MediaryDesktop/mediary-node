import { combine, createEvent, createStore, sample } from 'effector'
import type { Event, EventCallable, Store } from 'effector'

import type { RequestFailure } from '@shared/api'

import { OPDS_KINDS } from '../config/kinds'
import type { OPDSKind } from '../config/kinds'
import { bodyOf, canSubmit, checkParamsOf, EMPTY_FIELDS, fieldsOf } from '../lib/form'
import type { CheckParams, EditedServer, ServerBody, ServerFields } from '../lib/form'

type Failure = RequestFailure['error']

interface MutationLike<Params, Result> {
	start: EventCallable<Params>
	$pending: Store<boolean>
	finished: {
		success: Event<{ params: Params; result: Result }>
		failure: Event<{ params: Params; error: Failure }>
	}
}

export interface CheckOutcome {
	ok: boolean
	problem?: string
}

interface EditorUnits {
	create: MutationLike<ServerBody, unknown>
	update: MutationLike<{ id: number; body: ServerBody }, unknown>
	check: MutationLike<CheckParams, CheckOutcome>
}

export type Editing = { server: EditedServer | null } | null

// One editor per kind of server, open on at most one server (or on a new one)
// at a time.
//
// The editor owns what the form shows and what came back for it. A save or a
// check is this editor's only if it answers the very request the editor sent:
// another check sent since, or a field changed since, makes an older answer
// stale, and it is dropped rather than shown against fields it was not about.
export function createServerEditor({ create, update, check }: EditorUnits) {
	const opened = createEvent<EditedServer | null>()
	const closed = createEvent()
	const changed = createEvent<Partial<ServerFields>>()
	const checked = createEvent()
	const submitted = createEvent()

	const $editing = createStore<Editing>(null)
		.on(opened, (_, server) => ({ server }))
		.reset(closed)

	const $fields = createStore<ServerFields>(EMPTY_FIELDS)
		.on(opened, (_, server) => fieldsOf(server))
		.on(changed, (fields, patch) => ({ ...fields, ...patch }))

	const $server = $editing.map(editing => editing?.server ?? null)

	const checkSent = sample({
		clock: checked,
		source: { fields: $fields, server: $server },
		filter: ({ fields }) => fields.url.trim() !== '',
		fn: ({ fields, server }) => checkParamsOf(fields, server)
	})

	const $sentCheck = createStore<CheckParams | null>(null)
		.on(checkSent, (_, params) => params)
		.reset(opened, changed, closed)

	sample({ clock: checkSent, target: check.start })

	const $check = createStore<CheckOutcome | null>(null)
		.on(checkSent, () => null)
		.reset(opened, changed, closed)

	sample({
		clock: check.finished.success,
		source: $sentCheck,
		filter: (sent, { params }) => sent === params,
		fn: (_, { result }) => result,
		target: $check
	})

	sample({
		clock: check.finished.failure,
		source: $sentCheck,
		filter: (sent, { params }) => sent === params,
		fn: (): CheckOutcome => ({ ok: false, problem: 'unreachable' }),
		target: $check
	})

	const $canSubmit = $fields.map(canSubmit)

	const ready = sample({
		clock: submitted,
		source: { fields: $fields, server: $server, can: $canSubmit },
		filter: ({ can }) => can
	})

	const createSent = sample({
		clock: ready,
		filter: ({ server }) => server === null,
		fn: ({ fields }) => bodyOf(fields, null)
	})

	const updateSent = sample({
		clock: ready,
		filter: ({ server }) => server !== null,
		fn: ({ fields, server }) => ({ id: server!.id, body: bodyOf(fields, server) })
	})

	const $sentSave = createStore<object | null>(null)
		.on(createSent, (_, params) => params)
		.on(updateSent, (_, params) => params)
		.reset(opened, closed)

	sample({ clock: createSent, target: create.start })
	sample({ clock: updateSent, target: update.start })

	const mine = <Payload extends { params: object }>(clock: Event<Payload>) =>
		sample({
			clock,
			source: $sentSave,
			filter: (sent, { params }) => sent === params,
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
		(a, b, sent) => (a || b) && sent !== null
	)

	return {
		$editing,
		$fields,
		$check,
		$checking: check.$pending,
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

export type ServerEditor = ReturnType<typeof createServerEditor>

export const serverEditors: Record<OPDSKind, ServerEditor> = {
	manga: createServerEditor(OPDS_KINDS.manga),
	books: createServerEditor(OPDS_KINDS.books)
}
