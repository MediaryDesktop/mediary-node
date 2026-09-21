import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Drawer } from './Drawer'

function renderDrawer(props: { closable?: boolean } = {}) {
	return render(
		<Drawer open onOpenChange={vi.fn()} title='Create list' {...props}>
			<p>Body</p>
		</Drawer>
	)
}

describe('Drawer', () => {
	it('shows the title, the body and a close button by default', () => {
		renderDrawer()

		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(screen.getByText('Create list')).toBeInTheDocument()
		expect(screen.getByText('Body')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
	})

	it('leaves the close button out when it is not closable', () => {
		renderDrawer({ closable: false })

		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
	})
})
