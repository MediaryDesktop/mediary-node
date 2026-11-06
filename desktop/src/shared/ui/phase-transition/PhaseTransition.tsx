import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import styles from './PhaseTransition.module.scss'

const EXIT = { duration: 0.12, ease: [0.4, 0, 1, 1] } as const

export interface PhaseTransitionProps {
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
				className={clsx(styles.enter, className)}
				initial={false}
				exit={
					reduced
						? { opacity: 0, transition: EXIT }
						: { opacity: 0, transform: 'translateY(-8px)', transition: EXIT }
				}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}
