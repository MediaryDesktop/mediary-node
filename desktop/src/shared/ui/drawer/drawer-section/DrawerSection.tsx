import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './DrawerSection.module.scss'

export interface DrawerSectionProps {
	title?: ReactNode
	description?: ReactNode
	action?: ReactNode
	className?: string
	children?: ReactNode
	// False when the section continues the one above it rather than starting a
	// new group, e.g. a connection check right under the control it tests.
	divider?: boolean
}

export function DrawerSection({
	title,
	description,
	action,
	className,
	children,
	divider = true
}: DrawerSectionProps) {
	const header = (
		<>
			{title != null && <h3 className={styles.title}>{title}</h3>}
			{description != null && <p className={styles.description}>{description}</p>}
		</>
	)

	return (
		<section className={clsx(styles.section, !divider && styles.noDivider, className)}>
			{action != null ? (
				<div className={styles.headerRow}>
					<div className={styles.headerText}>{header}</div>
					<div className={styles.action}>{action}</div>
				</div>
			) : (
				header
			)}

			{children != null && (
				<div
					className={clsx(
						styles.body,
						description != null ? styles.spacedWithHint : title != null && styles.spaced
					)}
				>
					{children}
				</div>
			)}
		</section>
	)
}
