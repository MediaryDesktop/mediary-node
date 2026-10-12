import { describe, expect, it } from 'vitest'

import { isListIcon, LIST_ICONS, lucideName } from './ListIcon'

describe('lucideName', () => {
	it('turns a Lucide component name into the name the node stores', () => {
		expect(lucideName('LuGamepad2')).toBe('gamepad-2')
		expect(lucideName('LuHeartCrack')).toBe('heart-crack')
		expect(lucideName('LuList')).toBe('list')
	})
})

describe('isListIcon', () => {
	it('accepts only names from the set', () => {
		expect(LIST_ICONS).toContain('gamepad-2')
		expect(isListIcon('gamepad-2')).toBe(true)
		expect(isListIcon('not-an-icon')).toBe(false)
		expect(isListIcon('')).toBe(false)
		expect(isListIcon(null)).toBe(false)
	})
})
