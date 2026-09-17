import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DropdownMenu } from './DropdownMenu'
import type { DropdownMenuItem } from './DropdownMenu'

const ITEMS: DropdownMenuItem[] = [
	{ id: 'one', label: 'One', onSelect: vi.fn() },
	{ id: 'two', label: 'Two', onSelect: vi.fn() }
]

function openMenu() {
	fireEvent.pointerDown(screen.getByRole('button', { name: 'Open' }), { button: 0 })
}

describe('DropdownMenu', () => {
	it('opens on trigger click', () => {
		render(<DropdownMenu trigger={<button>Open</button>} items={ITEMS} />)

		expect(screen.queryByRole('menu')).not.toBeInTheDocument()

		openMenu()

		expect(screen.getByRole('menu')).toBeInTheDocument()
	})

	it('closes on a click outside', async () => {
		render(<DropdownMenu trigger={<button>Open</button>} items={ITEMS} />)

		openMenu()
		await new Promise(resolve => setTimeout(resolve, 0))
		fireEvent.pointerDown(document.body)

		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('closes when the user starts scrolling', () => {
		render(<DropdownMenu trigger={<button>Open</button>} items={ITEMS} />)

		openMenu()
		fireEvent.wheel(window)

		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('does not lock page scrolling while open', () => {
		render(<DropdownMenu trigger={<button>Open</button>} items={ITEMS} />)

		openMenu()

		expect(document.body.style.overflow).not.toBe('hidden')
	})
})
