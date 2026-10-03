import { describe, expect, it } from 'vitest'

import type { NodeSchemas } from '@infra/node'

import { initialAudio, initialSubtitle, trackLabel } from './tracks'

function sub(index: number, part: Partial<NodeSchemas['Subtitle']> = {}): NodeSchemas['Subtitle'] {
	return { index, codec: 'ass', extension: 'ass', is_default: false, is_forced: false, ...part }
}

function audio(index: number, part: Partial<NodeSchemas['Audio']> = {}): NodeSchemas['Audio'] {
	return { index, codec: 'aac', channels: 2, is_default: false, is_forced: false, ...part }
}

describe('initialSubtitle', () => {
	it('starts with the default track', () => {
		expect(initialSubtitle([sub(0), sub(1, { is_default: true })])).toBe(1)
	})

	it('passes over a forced track for a full one', () => {
		expect(initialSubtitle([sub(0, { is_forced: true, is_default: true }), sub(1)])).toBe(1)
	})

	it('has nothing to start with when there are no tracks', () => {
		expect(initialSubtitle([])).toBeNull()
	})
})

describe('initialAudio', () => {
	it('starts with the default track, else the first', () => {
		expect(initialAudio([audio(0), audio(1, { is_default: true })])).toBe(1)
		expect(initialAudio([audio(0), audio(1)])).toBe(0)
	})
})

describe('trackLabel', () => {
	it('names the language and keeps the title beside it', () => {
		expect(trackLabel(sub(0, { language: 'ru', title: 'Full' }), 'en')).toBe('Russian — Full')
	})

	it('falls back to a number when the track says nothing', () => {
		expect(trackLabel(sub(2), 'en')).toBe('#3')
	})
})
