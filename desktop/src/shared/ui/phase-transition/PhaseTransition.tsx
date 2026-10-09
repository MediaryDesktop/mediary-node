import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

// The spring Seanime moves its own sections with.
const PHASE_SPRING = { type: 'spring', damping: 28, stiffness: 260, mass: 0.7 } as const

export interface PhaseTransitionProps {
	// Whatever the content is showing right now — loading, failed, empty, loaded.
	// A new value plays the old content out and the new one in.
	phase: string
	children: ReactNode
	className?: string
}

export function PhaseTransition({ phase, children, className }: PhaseTransitionProps) {
	const reduced = useReducedMotion()

	return (
		<AnimatePresence mode='wait'>
			<motion.div
				key={phase}
				className={className}
				initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
				transition={reduced ? { duration: 0.2 } : PHASE_SPRING}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}
