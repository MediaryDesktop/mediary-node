import { useEffect, useRef } from 'react'

import styles from './ScrollProgress.module.scss'

// How far the page has been scrolled, as a thin line along the bottom edge. It
// writes to the bar directly: scrolling fires many times a second and none of that
// needs a re-render.
export function ScrollProgress() {
	const bar = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const update = () => {
			const element = bar.current
			if (!element) {
				return
			}

			const range = document.documentElement.scrollHeight - window.innerHeight
			const progress = range <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / range))
			element.style.transform = `scaleX(${progress})`
		}

		update()
		window.addEventListener('scroll', update, { passive: true })
		window.addEventListener('resize', update)

		// Content loads after the first paint, which changes how far there is to scroll.
		const observer = new ResizeObserver(update)
		observer.observe(document.body)

		return () => {
			window.removeEventListener('scroll', update)
			window.removeEventListener('resize', update)
			observer.disconnect()
		}
	}, [])

	return (
		<div className={styles.track} aria-hidden='true'>
			<div ref={bar} className={styles.bar} />
		</div>
	)
}
