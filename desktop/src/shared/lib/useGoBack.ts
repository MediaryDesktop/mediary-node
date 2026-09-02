import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

/**
 * "Back", with somewhere to land.
 *
 * A desktop window can be opened straight onto any route — a deep link, a
 * reload during development, a restored session — and `history.back()` on the
 * first entry of a hash history does nothing at all. The fallback is the
 * caller's, because only the screen knows where "out of here" is.
 */
export function useGoBack(fallback: string): () => void {
	const router = useRouter()

	return useCallback(() => {
		if (router.history.canGoBack()) {
			router.history.back()
			return
		}

		router.navigate({ to: fallback })
	}, [router, fallback])
}
