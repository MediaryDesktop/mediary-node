import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Checkbox } from '@shared/ui'
import type { CheckboxState } from '@shared/ui'

import styles from './CheckRow.module.scss'

export interface CheckRowProps {
	checked: CheckboxState
	onCheckedChange: (checked: boolean) => void
	label: string
	children?: ReactNode
}

export function CheckRow({ checked, onCheckedChange, label, children }: CheckRowProps) {
	return (
		<div
			role='presentation'
			className={clsx(styles.row, checked === false && styles.off)}
			onClick={() => onCheckedChange(checked !== true)}
		>
			<Checkbox checked={checked} onCheckedChange={onCheckedChange} label={label} />
			<span className={styles.label}>{children ?? label}</span>
		</div>
	)
}
