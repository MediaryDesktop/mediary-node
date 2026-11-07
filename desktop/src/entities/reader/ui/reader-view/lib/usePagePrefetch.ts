import { useEffect } from 'react'

import { prefetchIndexes } from '../../../lib/pages'
import { pageUrl } from '../../../lib/urls'

// Loads the pages around the one on screen, so turning to them shows them at
// once; leaving a page cancels what it started loading.
export function usePagePrefetch(ref: string, current: number, total: number): void {
	useEffect(() => {
		const preloaded = prefetchIndexes(current, total).map(index => {
			const image = new Image()
			image.src = pageUrl(ref, index)

			return image
		})

		return () => {
			for (const image of preloaded) {
				image.src = ''
			}
		}
	}, [current, total, ref])
}
