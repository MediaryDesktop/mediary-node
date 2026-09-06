import { combine, createEvent, createStore, sample } from 'effector'
import type { Event, EventCallable, Store, UnitTargetable } from 'effector'

import { notifyFailure, notifyProblems } from '../lib'

export interface Field {
	changed: EventCallable<string>
	$value: Store<string>
}

export function createField(initial = ''): Field {
	const changed = createEvent<string>()
	const $value = createStore(initial).on(changed, (_, value) => value)

	return { changed, $value }
}

export type Values<Names extends string> = Record<Names, string>

export type Fields<Names extends string> = Record<Names, Field>

export interface AuthFormConfig<Names extends string, Payload, Context> {
	fields: readonly Names[]
	validate: (values: Values<Names>, context: Context) => (string | null)[]
	prepare: (values: Values<Names>, context: Context) => Payload
	submit: UnitTargetable<Payload>
	pending: Store<boolean>
	failure?: Event<unknown>
}

export interface AuthForm<Names extends string, Context> {
	fields: Fields<Names>
	submitted: EventCallable<Context>
	$pending: Store<boolean>
	$values: Store<Values<Names>>
}

export function createAuthForm<Names extends string, Payload, Context = void>(
	config: AuthFormConfig<Names, Payload, Context>
): AuthForm<Names, Context> {
	const fields = Object.fromEntries(config.fields.map(name => [name, createField()])) as Fields<Names>

	const $values = combine(
		Object.fromEntries(config.fields.map(name => [name, fields[name].$value]))
	) as Store<Values<Names>>

	const submitted = createEvent<Context>()

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: (values, context) => ({
			values,
			context,
			problems: config
				.validate(values, context)
				.filter((problem): problem is string => problem !== null)
		})
	})

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length > 0,
		fn: ({ problems }) => problems
	}).watch(notifyProblems)

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length === 0,
		fn: ({ values, context }) => config.prepare(values, context),
		target: config.submit
	})

	config.failure?.watch(notifyFailure)

	return { fields, submitted, $pending: config.pending, $values }
}
