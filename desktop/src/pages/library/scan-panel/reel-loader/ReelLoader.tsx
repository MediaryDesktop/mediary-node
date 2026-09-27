import { useEffect, useRef } from 'react'

import styles from './ReelLoader.module.scss'

const SPIN_SPEED = 1080 / 2.2

export interface ReelLoaderProps {
	spinning: boolean
}

export function ReelLoader({ spinning }: ReelLoaderProps) {
	const diskRef = useRef<HTMLDivElement>(null)
	const frameRef = useRef<number | null>(null)
	const angleRef = useRef(0)
	const stateRef = useRef<'stopped' | 'spinning' | 'stopping'>('stopped')

	useEffect(() => {
		const disk = diskRef.current
		const reducedMotion =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches

		if (!disk || reducedMotion) {
			return
		}

		const setAngle = (angle: number) => {
			angleRef.current = angle
			disk.style.transform = `rotate(${angle}deg)`
		}

		const spin = () => {
			stateRef.current = 'spinning'

			let lastTime = 0

			const step = (time: number) => {
				if (!lastTime) {
					lastTime = time
				}

				setAngle(angleRef.current + (SPIN_SPEED * (time - lastTime)) / 1000)
				lastTime = time

				if (stateRef.current === 'spinning') {
					frameRef.current = requestAnimationFrame(step)
				}
			}

			frameRef.current = requestAnimationFrame(step)
		}

		const settle = () => {
			stateRef.current = 'stopping'

			const startAngle = angleRef.current
			const normalized = ((startAngle % 360) + 360) % 360
			const distance = 360 + (360 - normalized)
			const duration = (2 * distance) / SPIN_SPEED
			const startTime = performance.now()

			const step = (time: number) => {
				const elapsed = (time - startTime) / 1000
				const progress = Math.min(elapsed / duration, 1)

				setAngle(startAngle + SPIN_SPEED * elapsed * (1 - progress / 2))

				if (progress < 1) {
					frameRef.current = requestAnimationFrame(step)
				} else {
					setAngle(0)
					stateRef.current = 'stopped'
				}
			}

			frameRef.current = requestAnimationFrame(step)
		}

		if (spinning) {
			spin()
		} else if (stateRef.current === 'spinning') {
			settle()
		}

		return () => {
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current)
			}
		}
	}, [spinning])

	return (
		<div className={styles.reel} aria-hidden='true'>
			<div ref={diskRef} className={styles.disk}>
				<span className={styles.cutout} />
				<span className={styles.cutout} />
				<span className={styles.cutout} />
				<span className={styles.ring} />
				<span className={styles.core} />
			</div>
		</div>
	)
}
