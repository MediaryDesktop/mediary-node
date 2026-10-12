import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

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
