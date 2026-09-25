import { preferredTitle } from '@entities/tracker'
import type { TrackerEntry, TrackerStatus } from '@entities/tracker'

export const ENTRY_SORTS = ['default', 'title', 'score', 'progress', 'updated'] as const

export type EntrySort = (typeof ENTRY_SORTS)[number]

export const ANY = 'all'

export interface EntryFilters {
	title: string
	status: TrackerStatus | typeof ANY
	format: string
	genre: string
	sort: EntrySort
}

export const INITIAL_ENTRY_FILTERS: EntryFilters = {
	title: '',
	status: ANY,
	format: ANY,
	genre: ANY,
	sort: 'default'
}

export function hasActiveFilters(filters: EntryFilters): boolean {
	return (
		filters.title.trim() !== '' ||
		filters.status !== ANY ||
		filters.format !== ANY ||
		filters.genre !== ANY ||
		filters.sort !== 'default'
	)
}

// Only the formats present in the list are offered, so the control never shows
// an option that would empty the grid.
export function formatsOf(entries: TrackerEntry[]): string[] {
	const formats = new Set<string>()

	for (const entry of entries) {
		if (entry.media.format) {
			formats.add(entry.media.format)
		}
	}

	return [...formats].sort()
}

export function genresOf(entries: TrackerEntry[]): string[] {
	const genres = new Set<string>()

	for (const entry of entries) {
		for (const genre of entry.media.genres ?? []) {
			genres.add(genre)
		}
	}

	return [...genres].sort()
}

function compare(a: TrackerEntry, b: TrackerEntry, sort: EntrySort): number {
	switch (sort) {
		case 'title':
			return preferredTitle(a.media.title).localeCompare(preferredTitle(b.media.title))
		case 'score':
			return b.score - a.score
		case 'progress':
			return b.progress - a.progress
		case 'updated':
			return Date.parse(b.updated_at) - Date.parse(a.updated_at)
		default:
			return 0
	}
}

export function applyEntryFilters(entries: TrackerEntry[], filters: EntryFilters): TrackerEntry[] {
	const needle = filters.title.trim().toLowerCase()

	const matched = entries.filter(entry => {
		if (filters.status !== ANY && entry.status !== filters.status) {
			return false
		}

		if (filters.format !== ANY && entry.media.format !== filters.format) {
			return false
		}

		if (filters.genre !== ANY && !(entry.media.genres ?? []).includes(filters.genre)) {
			return false
		}

		if (needle === '') {
			return true
		}

		return Object.values(entry.media.title).some(
			name => typeof name === 'string' && name.toLowerCase().includes(needle)
		)
	})

	return filters.sort === 'default' ? matched : matched.slice().sort((a, b) => compare(a, b, filters.sort))
}
