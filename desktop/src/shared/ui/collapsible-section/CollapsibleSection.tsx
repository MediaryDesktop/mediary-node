import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './CollapsibleSection.module.scss'

export interface CollapsibleSectionProps {
	open: boolean
	children: ReactNode
	className?: string
}

export function CollapsibleSection({ open, children, className }: CollapsibleSectionProps) {
	return (
		<div className={clsx(styles.section, open && styles.open, className)}>
			<div className={styles.inner} aria-hidden={!open} inert={!open}>
				{children}
			</div>
		</div>
	)
}
