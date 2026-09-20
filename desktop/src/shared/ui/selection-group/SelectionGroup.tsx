import clsx from 'clsx'
import type { ReactNode } from 'react'

import { RippleButton } from '../ripple/RippleButton'

import styles from './SelectionGroup.module.scss'

export interface SelectionGroupOption<Value extends string> {
	value: Value
	label: string
	icon?: ReactNode
}

export interface SelectionGroupProps<Value extends string> {
	options: readonly SelectionGroupOption<Value>[]
	value: Value
	onValueChange: (value: Value) => void
	label?: string
	className?: string
}

export function SelectionGroup<Value extends string>({
	options,
	value,
	onValueChange,
	label,
	className
}: SelectionGroupProps<Value>) {
	return (
		<div role='group' aria-label={label} className={clsx(styles.group, className)}>
			{options.map(option => {
				const active = option.value === value

				return (
					<RippleButton
						key={option.value}
						className={clsx(styles.option, active && styles.active)}
						aria-pressed={active}
						onClick={() => onValueChange(option.value)}
					>
						{option.icon}
						{option.label}
					</RippleButton>
				)
			})}
		</div>
	)
}
