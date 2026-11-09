import { createEffect, createEvent, createStore } from 'effector'

import { HttpRequestError } from '@shared/api'

import { addTorrentFx } from '@entities/torrent'
import type { AddTorrentParams } from '@entities/torrent'

// What the stream picker shows of the episode being chosen for: the same card
// the episode list draws, so the viewer sees what the release is picked for.
export interface StreamPreview {
	label: string
	name: string | null
	duration: string | null
	of: number | null
	images: (string | null | undefined)[]
	coverColor: string | null
}

export interface SearchTarget {
	episode?: number
	season?: number
	intent?: 'download' | 'watch'
	preview?: StreamPreview
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
