import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaCard } from './MediaCard'

const MEDIA = {
	title: { user_preferred: 'Frieren', romaji: null, english: null, native: null },
	cover_image: null,
	cover_color: null
}

const TRACKING = {
	status: 'CURRENT',
	statusLabel: 'Watching',
	score: 85,
	genres: ['Adventure', 'Drama', 'Fantasy', 'Slice of Life'],
	year: 2023,
	mediaType: 'anime',
	progress: 3,
	total: 28
}

describe('MediaCard', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

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

	it('shows the progress of a tracked title on the poster', () => {
		render(<MediaCard media={MEDIA} tracking={TRACKING} />)

		expect(screen.getByText('3/28')).toBeInTheDocument()
		expect(screen.getByTitle('Watching')).toBeInTheDocument()
	})

	it('opens a panel with the details and actions on hover', () => {
		vi.useFakeTimers()
		const onOpen = vi.fn()

		render(
			<MediaCard
				media={MEDIA}
				previewRef='anilist:100'
				tracking={TRACKING}
				menu={<button type='button'>Add to list</button>}
				onOpen={onOpen}
			/>
		)

		expect(screen.queryByText('Watching')).toBeNull()

		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Frieren' }), { pointerType: 'mouse' })
		act(() => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText('Watching')).toBeInTheDocument()
		expect(screen.getByText('3 / 28')).toBeInTheDocument()
		expect(screen.getByText('Adventure, Drama, Fantasy, Slice of Life')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: /media\.card\.play|Play episode 4/ }))

		expect(onOpen).toHaveBeenCalledTimes(1)
	})
})
