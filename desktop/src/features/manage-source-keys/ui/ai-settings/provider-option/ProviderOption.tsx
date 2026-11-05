import clsx from 'clsx'
import type { ReactNode } from 'react'

import { RadioDot } from '@shared/ui'

import styles from './ProviderOption.module.scss'

export interface ProviderOptionProps {
	label: string
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	// A short chip beside the label, e.g. "Free" for Mediary AI.
	badge?: ReactNode
}

// One tile in the AI provider grid: a radio dot and a name, with an optional
// badge — the same shape as a debrid service tile, for the same reason: none
// of these need their own expanding detail to pick between them.
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
