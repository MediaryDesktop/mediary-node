import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export interface PageTransitionProps {
	children: ReactNode
	className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
	const reduced = useReducedMotion()

	return (
		<motion.div
			className={className}
			initial={reduced ? false : { opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
		>
			{children}
		</motion.div>
	)
}
