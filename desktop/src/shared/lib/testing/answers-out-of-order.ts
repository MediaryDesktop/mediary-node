import type { Query } from '@farfetched/core'
import { allSettled, fork } from 'effector'
import type { Effect, Scope } from 'effector'

// Starts a query for `older`, then for `newer`, and has the node answer them the
// wrong way round: `newer` first, `older` last. What the query holds afterwards
// tells whether a slow answer to a question nobody asks any more can overwrite
// the one the screen is waiting for.
export async function answersOutOfOrder<Params, Response, Failure>(
	query: Query<Params, Response, Failure>,
	effect: Effect<Params, Response>,
	[older, newer]: [Params, Params],
	answer: (params: Params) => Response
): Promise<Scope> {
	const waiting: { params: Params; reply: () => void }[] = []

	const scope = fork({
		handlers: [
			[
				effect,
				(params: Params) =>
					new Promise<Response>(resolve => {
						waiting.push({ params, reply: () => resolve(answer(params)) })
					})
			]
		]
	})

	const first = allSettled(query.start, { scope, params: older })
	const second = allSettled(query.start, { scope, params: newer })

	for (let tick = 0; waiting.length < 2; tick++) {
		if (tick > 100) {
			throw new Error(`the query asked the node ${waiting.length} time(s), not twice`)
		}

		await new Promise(resolve => setTimeout(resolve, 0))
	}

	waiting[1]!.reply()
	await new Promise(resolve => setTimeout(resolve, 0))
	waiting[0]!.reply()

	await Promise.all([first, second])

	return scope
}
