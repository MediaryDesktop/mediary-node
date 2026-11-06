import { useEffect } from 'react'

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
