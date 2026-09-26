import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { LibraryFile } from '../api/api'

import { LibraryFileRow } from './LibraryFileRow'

function file(overrides: Partial<LibraryFile> = {}): LibraryFile {
	return {
		id: 1,
		root_id: 1,
		path: 'D:\\Anime\\Frieren\\ep 01.mkv',
		rel_path: 'Frieren/ep 01.mkv',
		kind: 'video',
		size_bytes: 1024,
		modified_at: '2026-01-01T00:00:00Z',
		missing: false,
		parsed: { form: 'series', title: 'Frieren', episode: 1 },
		...overrides
	}
}

describe('LibraryFileRow', () => {
	it('shows the title, the number and the path the scan recorded', () => {
		render(<LibraryFileRow file={file()} />)

		expect(screen.getByText('Frieren')).toBeInTheDocument()
		expect(screen.getByText('#1')).toBeInTheDocument()
		expect(screen.getByText('Frieren/ep 01.mkv')).toBeInTheDocument()
	})

	it('says how sure an automatic match was', () => {
		render(
			<LibraryFileRow
				file={file({ match: { media_ref: 'anilist:154587', confidence: 0.93, source: 'auto' } })}
			/>
		)

		expect(screen.getByText('Matched 93%')).toBeInTheDocument()
	})

	it('marks a match the user made themselves', () => {
		render(
			<LibraryFileRow
				file={file({ match: { media_ref: 'anilist:154587', confidence: 1, source: 'manual' } })}
			/>
		)

		expect(screen.getByText('Matched by hand')).toBeInTheDocument()
	})

	it('offers to match a file that has no title yet', () => {
		const onMatch = vi.fn()

		render(<LibraryFileRow file={file()} onMatch={onMatch} />)

		expect(screen.getByText('Unmatched')).toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: 'Match' }))

		expect(onMatch).toHaveBeenCalledTimes(1)
	})

	// An opening belongs to no episode, so there is nothing to match it to.
	it('does not offer to match an extra', () => {
		render(
			<LibraryFileRow file={file({ parsed: { form: 'extra', title: 'Frieren' } })} onMatch={vi.fn()} />
		)

		expect(screen.queryByRole('button', { name: 'Match' })).toBeNull()
		expect(screen.queryByText('Unmatched')).toBeNull()
	})

	it('offers to play a video file', () => {
		const onPlay = vi.fn()

		render(<LibraryFileRow file={file()} onPlay={onPlay} />)

		fireEvent.click(screen.getByRole('button', { name: 'Play' }))

		expect(onPlay).toHaveBeenCalledTimes(1)
	})

	// There is nothing to open for a chapter or a book yet, and a button that does
	// nothing is worse than no button.
	it('does not offer to play what the node cannot play', () => {
		render(<LibraryFileRow file={file({ kind: 'manga' })} onPlay={vi.fn()} />)

		expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
	})

	it('does not offer to play a file the last scan did not find', () => {
		render(<LibraryFileRow file={file({ missing: true })} onPlay={vi.fn()} />)

		expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
	})

	it('flags a file the last scan did not find', () => {
		render(<LibraryFileRow file={file({ missing: true })} />)

		expect(screen.getByText('Missing')).toBeInTheDocument()
	})
})
