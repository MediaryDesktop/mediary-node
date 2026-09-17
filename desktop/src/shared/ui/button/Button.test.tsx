import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
	it('forwards the ref to the underlying element', () => {
		const ref = createRef<HTMLButtonElement>()

		render(<Button ref={ref}>Save</Button>)

		expect(ref.current).toBeInstanceOf(HTMLButtonElement)
		expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }))
	})

	it('renders an icon-only button without visible text', () => {
		render(
			<Button iconOnly aria-label='Options'>
				<span aria-hidden>⋮</span>
			</Button>
		)

		expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument()
	})

	it('disables the element while loading', () => {
		render(<Button loading>Save</Button>)

		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
	})
})
