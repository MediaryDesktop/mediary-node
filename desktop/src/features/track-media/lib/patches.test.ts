import { describe, expect, it } from 'vitest'

import type { TrackerEntry } from '@entities/tracker'

import { isEmptyPatch, managePatch, rateFormOf, ratePatch } from './patches'

const noDate = { year: null, month: null, day: null }

function entry(overrides: Partial<TrackerEntry> = {}): TrackerEntry {
	return {
		media_ref: 'anilist:1',
		status: 'PLANNING',
		score: 0,
		progress: 0,
		repeat: 0,
		notes: '',
		custom_lists: [],
		started_at: noDate,
		completed_at: noDate,
		...overrides
	} as TrackerEntry
}

describe('managePatch', () => {
	it('adds a new title with its status and the lists ticked', () => {
		expect(managePatch(null, 'PLANNING', ['Cosy'], '2026-10-12')).toEqual({
			status: 'PLANNING',
			custom_lists: ['Cosy']
		})
	})

	it('stamps today as the start and the end when a title is completed', () => {
		expect(managePatch(entry(), 'COMPLETED', [], '2026-10-12')).toEqual({
			status: 'COMPLETED',
			started_at: { year: 2026, month: 10, day: 12 },
			completed_at: { year: 2026, month: 10, day: 12 }
		})
	})

	it('sends nothing when nothing changed, whatever the order of the lists', () => {
		const saved = entry({ custom_lists: ['A', 'B'] })

		expect(isEmptyPatch(managePatch(saved, 'PLANNING', ['B', 'A'], '2026-10-12'))).toBe(true)
	})
})

describe('ratePatch', () => {
	it('sends only the changed fields', () => {
		const saved = entry({ score: 70 })

		expect(ratePatch(saved, { ...rateFormOf(saved), score: 85, notes: 'great' }, 'anime')).toEqual({
			score: 85,
			notes: 'great'
		})
	})

	it('counts volumes for manga only', () => {
		const saved = entry()
		const form = { ...rateFormOf(saved), volumes: 3 }

		expect(ratePatch(saved, form, 'manga')).toEqual({ progress_volumes: 3 })
		expect(isEmptyPatch(ratePatch(saved, form, 'anime'))).toBe(true)
	})
})
