import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { LibraryFile } from '../../api/api'

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
		ignored: false,
		parsed: { form: 'series', title: 'Frieren', episode: 1 },
		...overrides
	}
}

describe('LibraryFileRow', () => {
	it('shows the file name rather than the folder it sits in', () => {
		render(<LibraryFileRow file={file()} />)

		expect(screen.getByText('ep 01.mkv')).toBeInTheDocument()
		expect(screen.queryByText('Frieren/ep 01.mkv')).toBeNull()
	})

	it('numbers the season and the episode the scan read off the name', () => {
		render(
			<LibraryFileRow
				file={file({ parsed: { form: 'series', title: 'Frieren', season: 2, episode: 1 } })}
			/>
		)

		expect(screen.getByText('Season 2 · Episode 1')).toBeInTheDocument()
	})

	it('shows only the episode for a file whose name says nothing about seasons', () => {
		render(<LibraryFileRow file={file()} />)

		expect(screen.getByText('Episode 1')).toBeInTheDocument()
	})

	it('prefers the season the match settled on over the one in the name', () => {
		render(
			<LibraryFileRow
				file={file({
					parsed: { form: 'series', title: 'Frieren', season: 2, episode: 1 },
					match: { media_ref: 'anilist:154587', confidence: 1, source: 'manual', season: 3 }
				})}
			/>
		)

		expect(screen.getByText('Season 3 · Episode 1')).toBeInTheDocument()
	})

	it('numbers a comic by its chapter', () => {
		render(<LibraryFileRow file={file({ kind: 'manga', parsed: { form: 'manga', chapter: 12 } })} />)

		expect(screen.getByText('Chapter 12')).toBeInTheDocument()
	})

	it('shows how long the file runs as a clock reading', () => {
		render(<LibraryFileRow file={file({ duration_seconds: 1437 })} />)

		expect(screen.getByText('23:57')).toBeInTheDocument()
	})

	it('shows no time for a container the node could not read', () => {
		render(<LibraryFileRow file={file()} />)

		expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull()
	})

	it('says how sure an automatic match was on the control that changes it', () => {
		render(
			<LibraryFileRow
				file={file({ match: { media_ref: 'anilist:154587', confidence: 0.93, source: 'auto' } })}
				onMatch={vi.fn()}
			/>
		)

		expect(screen.getByRole('button', { name: 'Change' })).toHaveAttribute('title', 'Matched 93%')
	})

	it('marks a match the user made themselves', () => {
		render(
			<LibraryFileRow
				file={file({ match: { media_ref: 'anilist:154587', confidence: 1, source: 'manual' } })}
				onMatch={vi.fn()}
			/>
		)

		expect(screen.getByRole('button', { name: 'Change' })).toHaveAttribute('title', 'Matched by hand')
	})

	it('offers to match a file that has no title yet', () => {
		const onMatch = vi.fn()

		render(<LibraryFileRow file={file()} onMatch={onMatch} />)

		fireEvent.click(screen.getByRole('button', { name: 'Match' }))

		expect(onMatch).toHaveBeenCalledTimes(1)
	})

	it('does not offer to match an extra', () => {
		render(
			<LibraryFileRow file={file({ parsed: { form: 'extra', title: 'Frieren' } })} onMatch={vi.fn()} />
		)

		expect(screen.queryByRole('button', { name: 'Match' })).toBeNull()
	})

	it('offers to play a video file', () => {
		const onPlay = vi.fn()

		render(<LibraryFileRow file={file()} onPlay={onPlay} />)

		fireEvent.click(screen.getByRole('button', { name: 'Play' }))

		expect(onPlay).toHaveBeenCalledTimes(1)
	})

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
