import type { TFunction } from 'i18next'

import type { TorrentRuleCheck } from '@entities/torrent'

// "Ep. 3", or "Ep. 5–28" for a batch's run of episodes.
export function episodeLabel(episodes: number[], t: TFunction): string {
	const first = episodes[0] ?? 0
	const last = episodes[episodes.length - 1] ?? first

	if (first === last) {
		return t('torrents.files.episode', { number: first })
	}

	const contiguous = last - first + 1 === episodes.length

	return contiguous
		? t('torrents.search.episodes', { from: first, to: last })
		: episodes.map(episode => t('torrents.files.episode', { number: episode })).join(', ')
}

export interface CheckCounts {
	// Episodes the check found, across every release it planned.
	planned: number
	// What it added: episodes when every planned release went in, releases otherwise.
	added: number
}

// A batch brings several episodes in one torrent; people count episodes.
export function checkCounts(check: TorrentRuleCheck): CheckCounts {
	const planned = check.planned ?? []
	const episodes = planned.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0)

	return { planned: episodes, added: check.added === planned.length ? episodes : check.added }
}
