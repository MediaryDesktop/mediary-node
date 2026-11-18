import { useEffect, useMemo, useRef } from 'react'

export interface LatestAttempt {
	next: () => number
	isLatest: (attempt: number) => boolean
}

// Numbers asynchronous attempts — a request, a retry — so that only the answer
// to the latest one is used: a slow answer to an earlier try, or any answer
// arriving after the component is gone, is dropped instead of overwriting.
export function useLatestAttempt(): LatestAttempt {
	const state = useRef({ attempt: 0, gone: false })

	useEffect(() => {
		const current = state.current
		current.gone = false

		return () => {
			current.gone = true
		}
	}, [])

	return useMemo(
		() => ({
			next: () => ++state.current.attempt,
			isLatest: attempt => !state.current.gone && attempt === state.current.attempt
		}),
		[]
	)
}
