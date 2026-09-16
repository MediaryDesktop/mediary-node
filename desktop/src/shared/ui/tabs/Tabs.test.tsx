import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProgressBar } from '../progress-bar/ProgressBar'

import { Tabs } from './Tabs'

describe('Tabs', () => {
	it('reports the chosen tab and marks the active one', () => {
		const onValueChange = vi.fn()

		render(
			<Tabs
				value='anime'
				onValueChange={onValueChange}
				items={[
					{ value: 'anime', label: 'Anime' },
					{ value: 'manga', label: 'Manga' }
				]}
			/>
		)

		expect(screen.getByRole('tab', { name: 'Anime' })).toHaveAttribute('aria-selected', 'true')

		fireEvent.mouseDown(screen.getByRole('tab', { name: 'Manga' }), { button: 0 })

		expect(onValueChange).toHaveBeenCalledWith('manga')
	})
})

describe('ProgressBar', () => {
	it('clamps the fill and omits the maximum when it is unknown', () => {
		const { rerender } = render(<ProgressBar value={30} max={24} />)

		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '24')
		expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' })

		rerender(<ProgressBar value={3} max={null} />)

		expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuemax')
	})
})
