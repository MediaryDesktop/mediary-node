import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RippleButton } from './RippleButton'

function ripples(button: HTMLElement) {
	return button.getElementsByClassName('ripple__animation').length
}

describe('RippleButton', () => {
	it('is a plain button that keeps its own props and click handler', () => {
		const onClick = vi.fn()

		render(
			<RippleButton aria-pressed className='chip' onClick={onClick}>
				Anime
			</RippleButton>
		)

		const button = screen.getByRole('button', { name: 'Anime' })

		expect(button).toHaveAttribute('type', 'button')
		expect(button).toHaveAttribute('aria-pressed', 'true')
		expect(button).toHaveClass('chip')

		fireEvent.click(button)

		expect(onClick).toHaveBeenCalledOnce()
	})

	it('spreads a ripple from the press', () => {
		render(<RippleButton>Anime</RippleButton>)

		const button = screen.getByRole('button')

		expect(ripples(button)).toBe(0)

		fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' })

		expect(ripples(button)).toBe(1)
	})

	it('stays still when disabled or when the ripple is turned off', () => {
		const { rerender } = render(<RippleButton disabled>Anime</RippleButton>)

		fireEvent.pointerDown(screen.getByRole('button'), { button: 0, pointerType: 'mouse' })

		expect(ripples(screen.getByRole('button'))).toBe(0)

		rerender(<RippleButton disableRipple>Anime</RippleButton>)

		fireEvent.pointerDown(screen.getByRole('button'), { button: 0, pointerType: 'mouse' })

		expect(ripples(screen.getByRole('button'))).toBe(0)
	})
})
