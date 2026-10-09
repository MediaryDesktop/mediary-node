import clsx from 'clsx'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import styles from './PageTransition.module.scss'

export interface PageTransitionProps {
	children: ReactNode
	className?: string
	leaving?: boolean
	onLeft?: () => void
}

export function PageTransition({ children, className, leaving = false, onLeft }: PageTransitionProps) {
	const reduced = useReducedMotion()

	const leaveState = reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-10px)' }

	return (
		<motion.div
			className={clsx(styles.enter, className)}
			initial={false}
			animate={leaving ? leaveState : { opacity: 1, transform: 'none' }}
			transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
			onAnimationComplete={() => leaving && onLeft?.()}
		>
			{children}
		</motion.div>
	)
}
