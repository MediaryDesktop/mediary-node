import { describe, expect, it } from 'vitest'

import type { ManualDraft } from '@entities/media'

import type { AiMergeField } from './ai-merge'
import { mergeSuggestion, withoutAiFilled } from './ai-merge'
import { completeness, completenessFields, fieldFilled } from './completeness'
import { formatAfterTypeChange } from './draft'

describe('formatAfterTypeChange', () => {
	it('keeps a format the new kind accepts', () => {
		expect(formatAfterTypeChange('anime', 'OVA')).toBe('OVA')
		expect(formatAfterTypeChange('manga', 'NOVEL')).toBe('NOVEL')
	})

	it('drops a format the new kind would be refused with', () => {
		expect(formatAfterTypeChange('book', 'OVA')).toBeUndefined()
		expect(formatAfterTypeChange('movie', 'ONE_SHOT')).toBeUndefined()
	})

	it('leaves an empty format empty', () => {
		expect(formatAfterTypeChange('book', undefined)).toBeUndefined()
	})
})

describe('completeness', () => {
	const draft = { media_type: 'anime', title: 'Frieren' } as const

	it('counts the kind as filled once it is picked', () => {
		expect(completeness(draft, false).required.filled).toBe(2)
		expect(completeness(draft, false, true).required.filled).toBe(2)
	})

	it('does not count the placeholder kind before the user picks one', () => {
		const required = completeness(draft, false, false).required

		expect(required.filled).toBe(1)
		expect(required.total).toBe(4)
	})
})

describe('completenessFields', () => {
	it('counts what each kind is measured by', () => {
		expect(completenessFields('book').recommended).toContain('pages')
		expect(completenessFields('book').additional).toContain('authors')
		expect(completenessFields('movie').recommended).toContain('duration')
		expect(completenessFields('manga').additional).toContain('volumes')
		expect(completenessFields('series').additional).toContain('seasons')
	})
})

describe('fieldFilled', () => {
	const draft: ManualDraft = { media_type: 'anime', title: 'Frieren', genres: [] }

	it('treats the placeholder kind as not filled', () => {
		expect(fieldFilled(draft, 'media_type', false, false)).toBe(false)
		expect(fieldFilled(draft, 'media_type', false)).toBe(true)
	})

	it('reads the poster from outside the draft', () => {
		expect(fieldFilled(draft, 'cover', true)).toBe(true)
		expect(fieldFilled(draft, 'cover', false)).toBe(false)
	})

	it('does not count an empty list as filled', () => {
		expect(fieldFilled(draft, 'genres', false)).toBe(false)
	})
})

describe('mergeSuggestion', () => {
	const typed = { media_type: 'book', title: 'Dune', year: 1965 } as const

	it('fills only what the user left empty', () => {
		const { draft, filled } = mergeSuggestion(typed, {
			...typed,
			year: 1999,
			authors: ['Frank Herbert']
		})

		expect(draft.year).toBe(1965)
		expect(draft.authors).toEqual(['Frank Herbert'])
		expect([...filled]).toEqual(['authors'])
	})

	it('replaces what an earlier answer put there and clears what the new one lacks', () => {
		const first = mergeSuggestion(
			{ media_type: 'book', title: 'Dune' },
			{ media_type: 'book', title: 'Dune', genres: ['Sci-Fi'], authors: ['Frank Herbert'], pages: 600 }
		)

		const second = mergeSuggestion(
			{ ...first.draft, title: 'Emma' },
			{ media_type: 'book', title: 'Emma', authors: ['Jane Austen'] },
			first.filled
		)

		expect(second.draft.authors).toEqual(['Jane Austen'])
		expect(second.draft.genres).toEqual([])
		expect(second.draft.pages).toBeUndefined()
	})

	it('never replaces a value the user has since edited', () => {
		const aiFilled = new Set<AiMergeField>(['authors'])
		const edited = { media_type: 'book', title: 'Emma', pages: 300 } as const

		const { draft } = mergeSuggestion(edited, { ...edited, pages: 500 }, aiFilled)

		expect(draft.pages).toBe(300)
	})
})

describe('withoutAiFilled', () => {
	it('drops the values an answer filled in and keeps the typed ones', () => {
		const own = withoutAiFilled(
			{ media_type: 'book', title: 'Dune', year: 1965, genres: ['Sci-Fi'] },
			new Set<AiMergeField>(['year', 'genres'])
		)

		expect(own.title).toBe('Dune')
		expect(own.year).toBeUndefined()
		expect(own.genres).toEqual([])
	})
})
