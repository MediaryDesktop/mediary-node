import { useEffect, useRef } from 'react'

import styles from './ScrollProgress.module.scss'

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
