import clsx from 'clsx'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

import { Icon } from '../icon/Icon'

import styles from './Select.module.scss'

export interface SelectOption {
	value: string
	label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
	options: SelectOption[]
	startIcon?: ReactNode
	error?: string
	className?: string
}

export function Select({ options, startIcon, error, className, id, ...props }: SelectProps) {
	const generatedId = useId()
	const selectId = id ?? generatedId
	const errorId = `${selectId}-error`

	return (
		<div className={clsx(styles.field, className)}>
			<div className={styles.control}>
				{startIcon && <span className={styles.startIcon}>{startIcon}</span>}

				<select
					{...props}
					id={selectId}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					className={clsx(
						styles.select,
						startIcon && styles.withStartIcon,
						error && styles.invalid
					)}
				>
					{options.map(option => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>

				<Icon name='common/chevron-down' size={16} className={styles.chevron} />
			</div>

			{error && (
				<p id={errorId} className={styles.error}>
					{error}
				</p>
			)}
		</div>
	)
}
