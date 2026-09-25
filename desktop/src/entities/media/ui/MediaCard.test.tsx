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

		render(<MediaCard media={MEDIA} onOpen={onOpen} />)

		fireEvent.click(screen.getByRole('button', { name: 'Frieren' }))

		expect(onOpen).toHaveBeenCalledTimes(1)
	})

	it('renders a static card without an open handler', () => {
		render(
			<MediaCard media={MEDIA} cornerLabel='SEQUEL'>
				<span>controls</span>
			</MediaCard>
		)

		expect(screen.queryByRole('button')).toBeNull()
		expect(screen.getByText('SEQUEL')).toBeInTheDocument()
		expect(screen.getByText('controls')).toBeInTheDocument()
	})

	it('shows list status, score and up to three genres for a tracked title', () => {
		render(
			<MediaCard
				media={MEDIA}
				previewRef='anilist:100'
				tracking={{
					statusLabel: 'Watching',
					score: 85,
					genres: ['Adventure', 'Drama', 'Fantasy', 'Slice of Life'],
					year: 2023
				}}
			/>
		)

		expect(screen.getByText('Watching')).toBeInTheDocument()
		expect(screen.getByText('8.5')).toBeInTheDocument()
		expect(screen.getByText('2023')).toBeInTheDocument()
		expect(screen.getByText('Adventure, Drama, Fantasy')).toBeInTheDocument()
	})
})
