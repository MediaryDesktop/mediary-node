import { createEffect, createEvent, createStore } from 'effector'

import { HttpRequestError } from '@shared/api'

import { addTorrentFx } from '@entities/torrent'
import type { AddTorrentParams } from '@entities/torrent'

export interface SearchTarget {
	episode?: number
	season?: number
	intent?: 'download' | 'watch'
}

export const searchOpened = createEvent<SearchTarget | void>()
export const searchClosed = createEvent()

export const $searchOpen = createStore(false)
	.on(searchOpened, () => true)
	.reset(searchClosed)

export const $searchTarget = createStore<SearchTarget>({})
	.on(searchOpened, (_, target) => target ?? {})
	.reset(searchClosed)

export interface DownloadOutcome {
	added: number
	failures: string[]
}

export const downloadReleasesFx = createEffect(
	async (items: AddTorrentParams[]): Promise<DownloadOutcome> => {
		const outcome: DownloadOutcome = { added: 0, failures: [] }

		for (const item of items) {
			try {
				await addTorrentFx(item)
				outcome.added++
			} catch (error) {
				outcome.failures.push(
					error instanceof HttpRequestError && error.body?.detail
						? error.body.detail
						: String(error)
				)
			}
		}

		return outcome
	}
)
