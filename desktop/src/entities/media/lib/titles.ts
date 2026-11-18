import { firstPresent } from '@shared/lib'

import type { MediaEpisode, MediaTitle } from '../api/api'

export function mediaTitle(title: MediaTitle): string {
	return firstPresent(title.user_preferred, title.english, title.romaji, title.native)
}

export function alternativeTitles(title: MediaTitle): string[] {
	const main = mediaTitle(title)
	const seen = new Set([main])
	const result: string[] = []

	for (const candidate of [title.english, title.romaji, title.native]) {
		if (candidate && !seen.has(candidate)) {
			seen.add(candidate)
			result.push(candidate)
		}
	}

	return result
}

// The language the app is shown in, then its base ("uk" for "uk-UA"), then
// English, then the romanisation, then whatever the node chose.
export function episodeTitle(episode: MediaEpisode, language: string): string | null {
	const titles = episode.titles ?? {}
	const base = language.split('-')[0] ?? language

	return titles[language] ?? titles[base] ?? titles.en ?? titles['x-jat'] ?? episode.title ?? null
}
