export type QueryPhase = 'loading' | 'failed' | 'empty' | 'ready'

export interface QueryPhaseInput<Data> {
	data: Data | null | undefined
	failed: boolean
	isEmpty?: (data: Data) => boolean
}

// One answer to "what does this screen show" for every query: data it already
// has stays on screen through a failed refresh; without data, a failure is
// shown as one, with a way to try again, and never as an empty list.
export function queryPhase<Data>({ data, failed, isEmpty }: QueryPhaseInput<Data>): QueryPhase {
	if (data === null || data === undefined) {
		return failed ? 'failed' : 'loading'
	}

	return isEmpty?.(data) ? 'empty' : 'ready'
}
