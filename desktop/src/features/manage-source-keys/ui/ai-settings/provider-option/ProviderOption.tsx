import clsx from 'clsx'
import type { ReactNode } from 'react'

import { RadioDot } from '@shared/ui'

import styles from './ProviderOption.module.scss'

export interface ProviderOptionProps {
	label: string
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	badge?: ReactNode
}

export function ProviderOption({ label, selected, disabled, onSelect, badge }: ProviderOptionProps) {
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
