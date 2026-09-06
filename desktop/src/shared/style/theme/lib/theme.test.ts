import { beforeEach, describe, expect, it } from 'vitest'

import { getSurfaceTheme, getTheme, pinTheme, setTheme } from './theme'

function painted(): string | undefined {
	return document.documentElement.dataset.theme
}

describe('pinning a theme to a surface', () => {
	beforeEach(() => {
		setTheme('light')
	})

	it('paints the pinned theme without changing what the user chose', () => {
		const release = pinTheme('dark')

		expect(painted()).toBe('dark')
		expect(getSurfaceTheme()).toBe('dark')
		expect(getTheme()).toBe('light')

		release()

		expect(painted()).toBe('light')
		expect(getSurfaceTheme()).toBe('light')
	})

	it('keeps the pin while a second holder still wants it', () => {
		const first = pinTheme('dark')
		const second = pinTheme('dark')

		first()
		expect(painted()).toBe('dark')

		second()
		expect(painted()).toBe('light')
	})

	it('ignores a release that already ran', () => {
		const first = pinTheme('dark')
		const second = pinTheme('dark')

		first()
		first()

		expect(painted()).toBe('dark')

		second()
		expect(painted()).toBe('light')
	})

	it('honours a theme chosen while pinned once the pin is released', () => {
		const release = pinTheme('dark')

		setTheme('light')
		expect(painted()).toBe('dark')

		setTheme('dark')
		expect(getTheme()).toBe('dark')
		expect(painted()).toBe('dark')

		release()
		expect(painted()).toBe('dark')
	})
})
