import { createEffect, createEvent, createStore } from 'effector'

import { HttpRequestError } from '@shared/api'

import { addTorrentFx } from '@entities/torrent'
import type { AddTorrentParams } from '@entities/torrent'

// What the sheet opens on: an episode, from the stream view without auto-select.
export interface SearchTarget {
	episode?: number
	season?: number
}

// The search sheet, opened from the title's header, its Torrents tab, or an
// episode of the stream view.
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

// Several releases, one after another: the node checks each against what is
// already downloading, and a failure of one must not stop the rest.
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
