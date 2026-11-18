import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from '../../SettingsPage.module.scss'

export function SettingsCard({ children }: { children: ReactNode }) {
	return <div className={styles.card}>{children}</div>
}

export interface SettingsRowProps {
	name: string
	hint: string
	block?: boolean
	children: ReactNode
}

export function SettingsRow({ name, hint, block, children }: SettingsRowProps) {
	return (
		<div className={clsx(styles.row, block && styles.block)}>
			<div className={styles.label}>
				<div className={styles.labelText}>
					<span className={styles.name}>{name}</span>
					<span className={styles.hint}>{hint}</span>
				</div>
			</div>
			<div className={styles.control}>{children}</div>
		</div>
	)
}
