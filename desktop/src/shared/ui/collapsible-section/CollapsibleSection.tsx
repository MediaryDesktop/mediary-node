import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './CollapsibleSection.module.scss'

export interface CollapsibleSectionProps {
	open: boolean
	children: ReactNode
	className?: string
}

// A block that unfolds by its height rather than appearing at once: the row the
// grid gives it eases from nothing to its content, so nothing needs measuring. Shut,
// its controls are inert — a hidden switch is not something Tab should land on.
export function CollapsibleSection({ open, children, className }: CollapsibleSectionProps) {
	return (
		<div className={clsx(styles.section, open && styles.open, className)}>
			<div className={styles.inner} aria-hidden={!open} inert={!open}>
				{children}
			</div>
		</div>
	)
}
