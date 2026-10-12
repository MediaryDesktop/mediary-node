import { useEffect } from 'react'

// Warms the browser's cache for every image the banner will show, so a swap
// reveals a picture that is already there instead of one still loading in.
export function usePreloadImages(sources: (string | null | undefined)[]): void {
	const key = sources.join('\n')

	useEffect(() => {
		const preloaded = key.split('\n').map(src => {
			const image = new Image()
			if (src) {
				image.src = src
			}

			return image
		})

		return () => {
			for (const image of preloaded) {
				image.src = ''
			}
		}
	}, [key])
}
