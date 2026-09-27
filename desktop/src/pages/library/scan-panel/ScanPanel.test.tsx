import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { LibraryScan, ScanActivity } from '@entities/library-item'

import { ScanPanel } from './ScanPanel'

function scan(overrides: Partial<LibraryScan> = {}): LibraryScan {
	return {
		running: false,
		roots: [],
		roots_total: 0,
		roots_done: 0,
		found: 0,
		added: 0,
		changed: 0,
		reparsed: 0,
		missing: 0,
		probed: 0,
		considered: 0,
		matched: 0,
		...overrides
	}
}

function activity(overrides: Partial<ScanActivity> = {}): ScanActivity {
	return { phase: 'scanning', found: 0, done: 0, total: 0, rootsDone: 0, rootsTotal: 0, ...overrides }
}

describe('ScanPanel', () => {
	// The panel is part of the page, not something that appears while a scan runs:
	// a library with nothing to report still has to say so.
	it('stays on the page when nothing is running', () => {
		render(<ScanPanel activity={null} scan={scan()} />)

		expect(screen.getByText('Scanning the library')).toBeInTheDocument()
		expect(screen.getByText('Not scanned yet')).toBeInTheDocument()
	})

	it('reports the last scan between runs', () => {
		render(
			<ScanPanel
				activity={null}
				scan={scan({ finished_at: new Date().toISOString(), found: 2348, matched: 2224 })}
			/>
		)

		expect(screen.getByText(/2348 files found/)).toBeInTheDocument()
		expect(screen.getByText(/2224 matched/)).toBeInTheDocument()
		expect(screen.getByText('100%')).toBeInTheDocument()
	})

	// The percentage on its own means nothing: the bar is what it reads against.
	it('draws a bar the percentage can be read against', () => {
		render(
			<ScanPanel
				activity={activity({ phase: 'probing', done: 3, total: 4, rootsDone: 1, rootsTotal: 1 })}
				scan={scan({ running: true })}
			/>
		)

		const bar = screen.getByRole('progressbar')

		expect(bar).toHaveAttribute('aria-valuenow', '75')
		expect(bar).toHaveAttribute('aria-valuemax', '100')
	})

	// The column beside the divider is the panel's shape, not a thing that only
	// appears when something breaks.
	it('reports what the last scan moved when every folder read', () => {
		render(
			<ScanPanel
				activity={null}
				scan={scan({ finished_at: new Date().toISOString(), added: 98, changed: 2, missing: 1 })}
			/>
		)

		expect(screen.getByText('Every folder read')).toBeInTheDocument()
		expect(screen.getByText('New')).toBeInTheDocument()
		expect(screen.getByText('98')).toBeInTheDocument()
	})

	it('follows the running scan through its phases', () => {
		render(
			<ScanPanel
				activity={activity({ phase: 'matching', done: 3, total: 5, rootsDone: 5, rootsTotal: 5 })}
				scan={scan({ running: true })}
			/>
		)

		expect(screen.getByText(/Matching titles/)).toBeInTheDocument()
		expect(screen.getByText(/5 of 5 folders/)).toBeInTheDocument()
		expect(screen.getByText('60%')).toBeInTheDocument()
	})

	it('names the folders it could not read', () => {
		render(
			<ScanPanel
				activity={null}
				scan={scan({
					roots: [
						{ root_id: 1, path: 'D:\\Anime\\Other', error: 'access denied' },
						{ root_id: 2, path: 'E:\\Manga\\Incomplete', error: 'drive not ready' }
					].map(root => ({
						...root,
						found: 0,
						added: 0,
						changed: 0,
						reparsed: 0,
						missing: 0,
						probed: 0
					}))
				})}
			/>
		)

		expect(screen.getByText('Could not read:')).toBeInTheDocument()
		expect(screen.getByText('D:\\Anime\\Other')).toBeInTheDocument()
		expect(screen.getByText('E:\\Manga\\Incomplete')).toBeInTheDocument()
	})
})
