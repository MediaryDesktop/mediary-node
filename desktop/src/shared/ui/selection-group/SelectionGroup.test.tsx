import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SelectionGroup } from './SelectionGroup'

const OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'anime', label: 'Anime', icon: <svg data-testid='anime-icon' /> },
	{ value: 'manga', label: 'Manga' }
] as const

describe('SelectionGroup', () => {
	it('marks the chosen option and reports a different one', () => {
		const onValueChange = vi.fn()

		render(
			<SelectionGroup options={OPTIONS} value='all' onValueChange={onValueChange} label='Media type' />
		)

		expect(screen.getByRole('group', { name: 'Media type' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByRole('button', { name: 'Anime' })).toHaveAttribute('aria-pressed', 'false')

		fireEvent.click(screen.getByRole('button', { name: 'Anime' }))

		expect(onValueChange).toHaveBeenCalledWith('anime')
	})

	it('renders an option icon before its label', () => {
		render(<SelectionGroup options={OPTIONS} value='all' onValueChange={vi.fn()} />)

		expect(screen.getByRole('button', { name: 'Anime' })).toContainElement(
			screen.getByTestId('anime-icon')
		)
	})

	it('locks every option when disabled and still shows the chosen one', () => {
		const onValueChange = vi.fn()

		render(<SelectionGroup options={OPTIONS} value='anime' onValueChange={onValueChange} disabled />)

		expect(screen.getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true)
		expect(screen.getByRole('button', { name: 'Anime' })).toHaveAttribute('aria-pressed', 'true')

		fireEvent.click(screen.getByRole('button', { name: 'Manga' }))

		expect(onValueChange).not.toHaveBeenCalled()
	})

	it('offers no selection when the value matches no option', () => {
		render(<SelectionGroup options={OPTIONS} value={'other' as 'all'} onValueChange={vi.fn()} />)

		expect(
			screen.getAllByRole('button').every(button => button.getAttribute('aria-pressed') === 'false')
		).toBe(true)
	})
})
