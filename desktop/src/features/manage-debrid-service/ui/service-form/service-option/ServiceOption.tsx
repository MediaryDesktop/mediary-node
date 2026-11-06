import clsx from 'clsx'
import type { ReactNode } from 'react'

import { RadioDot } from '@shared/ui'

import styles from './ServiceOption.module.scss'

export interface ServiceOptionProps {
	label: string
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	badge?: ReactNode
}

export function ServiceOption({ label, selected, disabled, onSelect, badge }: ServiceOptionProps) {
	return (
		<button
			type='button'
			role='radio'
			aria-checked={selected}
			disabled={disabled}
			className={clsx(styles.option, selected && styles.selected)}
			onClick={onSelect}
		>
			<RadioDot selected={selected} />
			<span className={styles.label}>{label}</span>
			{badge}
		</button>
	)
}
