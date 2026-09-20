import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl'

const ITEMS = [
	{ value: 'dark', label: 'D', ariaLabel: 'Dark theme' },
	{ value: 'light', label: 'L', ariaLabel: 'Light theme' },
	{ value: 'system', label: 'S', ariaLabel: 'System theme' }
] as const

describe('SegmentedControl', () => {
	it('marks the chosen option and reports a different one', () => {
		const onValueChange = vi.fn()

		render(<SegmentedControl items={ITEMS} value='dark' onValueChange={onValueChange} label='Theme' />)

		expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'false')

		fireEvent.click(screen.getByRole('button', { name: 'Light theme' }))

		expect(onValueChange).toHaveBeenCalledWith('light')
	})

	it('slides the indicator to the active option', () => {
		const { rerender } = render(<SegmentedControl items={ITEMS} value='dark' onValueChange={vi.fn()} />)

		const root = screen.getByRole('group')

		expect(root.style.getPropertyValue('--segments')).toBe('3')
		expect(root.style.getPropertyValue('--index')).toBe('0')

		rerender(<SegmentedControl items={ITEMS} value='system' onValueChange={vi.fn()} />)

		expect(root.style.getPropertyValue('--index')).toBe('2')
	})

	it('shows no indicator when the value matches no option', () => {
		render(<SegmentedControl items={ITEMS} value={'other' as 'dark'} onValueChange={vi.fn()} />)

		expect(screen.getByRole('group').querySelector('[aria-hidden]')).toBeNull()
		expect(
			screen.getAllByRole('button').every(button => button.getAttribute('aria-pressed') === 'false')
		).toBe(true)
	})

	it('falls back to the accessible name as the tooltip for icon-only options', () => {
		render(<SegmentedControl items={ITEMS} value='dark' onValueChange={vi.fn()} />)

		expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('title', 'Dark theme')
	})
})
