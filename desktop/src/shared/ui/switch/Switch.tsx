import clsx from 'clsx'
import { useId } from 'react'

import styles from './Switch.module.scss'

export interface SwitchProps {
	checked: boolean
	onChange: (checked: boolean) => void
	label: string
	disabled?: boolean
	className?: string
	id?: string
}

export function Switch({ checked, onChange, label, disabled = false, className, id }: SwitchProps) {
	const generatedId = useId()
	const labelId = `${id ?? generatedId}-label`

	return (
		<div className={clsx(styles.row, className)}>
			<button
				type='button'
				role='switch'
				id={id ?? generatedId}
				aria-checked={checked}
				aria-labelledby={labelId}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={clsx(styles.track, checked && styles.on)}
			>
				<span className={styles.thumb} />
			</button>

			<label id={labelId} htmlFor={id ?? generatedId} className={styles.label}>
				{label}
			</label>
		</div>
	)
}
