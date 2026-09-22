import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export interface PageTransitionProps {
	children: ReactNode
	className?: string
	leaving?: boolean
	onLeft?: () => void
}

export function PageTransition({ children, className, leaving = false, onLeft }: PageTransitionProps) {
	const reduced = useReducedMotion()

	const leaveState = reduced ? { opacity: 0 } : { opacity: 0, y: -10 }

	return (
		<motion.div
			className={className}
			initial={reduced ? false : { opacity: 0, y: 10 }}
			animate={leaving ? leaveState : { opacity: 1, y: 0 }}
			transition={{ duration: leaving ? 0.16 : 0.24, ease: [0.2, 0, 0, 1] }}
			onAnimationComplete={() => leaving && onLeft?.()}
		>
			{children}
		</motion.div>
	)
}
