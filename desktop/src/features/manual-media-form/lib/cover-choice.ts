import type { CoverSelection } from './cover'

// The cover the form holds, and whether the assistant put it there. The two
// change together: a poster found while the user was picking their own must
// neither replace their pick nor mark it as the assistant's.
export interface CoverChoice {
	selection: CoverSelection
	automatic: boolean
}

export const NO_COVER_CHOICE: CoverChoice = { selection: { kind: 'keep' }, automatic: false }

// The assistant found a poster: it goes in when there is no cover yet or the
// one there is its own; the user's pick stays as it is.
export function coverFound(current: CoverChoice, poster: CoverSelection): CoverChoice {
	if (current.selection.kind === 'keep' || current.automatic) {
		return { selection: poster, automatic: true }
	}

	return current
}

// The assistant no longer stands by its poster: its own cover goes, the user's stays.
export function coverLost(current: CoverChoice): CoverChoice {
	return current.automatic ? NO_COVER_CHOICE : current
}
