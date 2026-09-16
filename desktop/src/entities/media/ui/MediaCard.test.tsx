import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MediaCard } from './MediaCard'

const MEDIA = {
	title: { user_preferred: 'Frieren', romaji: null, english: null, native: null },
	cover_image: null,
	cover_color: null
}

describe('MediaCard', () => {
	it('opens the title when it is clickable', () => {
		const onOpen = vi.fn()

		render(<MediaCard media={MEDIA} caption='TV · 2023' onOpen={onOpen} />)

		fireEvent.click(screen.getByRole('button', { name: /Frieren/ }))

		expect(onOpen).toHaveBeenCalledTimes(1)
		expect(screen.getByText('TV · 2023')).toBeInTheDocument()
	})

	it('renders a static card without an open handler', () => {
		render(
			<MediaCard media={MEDIA}>
				<span>controls</span>
			</MediaCard>
		)

		expect(screen.queryByRole('button')).toBeNull()
		expect(screen.getByText('controls')).toBeInTheDocument()
	})
})
