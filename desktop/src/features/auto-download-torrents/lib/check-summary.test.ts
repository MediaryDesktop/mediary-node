import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { TorrentRuleCheck } from '@entities/torrent'

import { checkCounts, episodeLabel } from './check-summary'

const t = ((key: string, options: Record<string, number>) =>
	key === 'torrents.files.episode'
		? `Ep. ${options.number}`
		: `Ep. ${options.from}–${options.to}`) as TFunction

function check(added: number, ...episodes: number[][]): TorrentRuleCheck {
	return { added, planned: episodes.map(list => ({ episodes: list })) } as unknown as TorrentRuleCheck
}

describe('auto-download check summary', () => {
	it('names one episode, a run, or scattered episodes', () => {
		expect(episodeLabel([3], t)).toBe('Ep. 3')
		expect(episodeLabel([5, 6, 7], t)).toBe('Ep. 5–7')
		expect(episodeLabel([2, 4], t)).toBe('Ep. 2, Ep. 4')
	})

	it('counts episodes when every planned release went in', () => {
		expect(checkCounts(check(2, [1, 2, 3], [4]))).toEqual({ planned: 4, added: 4 })
	})

	it('falls back to releases when only some went in', () => {
		expect(checkCounts(check(1, [1, 2, 3], [4]))).toEqual({ planned: 4, added: 1 })
	})
})
