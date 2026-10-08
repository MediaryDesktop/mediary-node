import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Carousel } from './Carousel'

describe('Carousel', () => {
	it('lays each child out as an item of a labelled region', () => {
		render(
			<Carousel aria-label='Related titles'>
				<span>One</span>
				<span>Two</span>
				<span>Three</span>
			</Carousel>
		)

		const region = screen.getByRole('region', { name: 'Related titles' })
		expect(region.querySelectorAll('li')).toHaveLength(3)
		expect(screen.getByText('Two')).toBeTruthy()
	})

	it('shows no arrows while there is nowhere to scroll', () => {
		render(
			<Carousel aria-label='Recommended'>
				<span>Only</span>
			</Carousel>
		)

		expect(screen.queryAllByRole('button')).toHaveLength(0)
	})
})
