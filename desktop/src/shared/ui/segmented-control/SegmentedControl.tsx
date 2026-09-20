import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'

import { RippleButton } from '../ripple/RippleButton'

import styles from './SegmentedControl.module.scss'

export interface SegmentedControlItem<Value extends string> {
	value: Value
	label: ReactNode
	ariaLabel?: string
	title?: string
}

export interface SegmentedControlProps<Value extends string> {
	items: readonly SegmentedControlItem<Value>[]
	value: Value
	onValueChange: (value: Value) => void
	size?: 'default' | 'large'
	label?: string
	className?: string
}

export function SegmentedControl<Value extends string>({
	items,
	value,
	onValueChange,
	size = 'default',
	label,
	className
}: SegmentedControlProps<Value>) {
	const activeIndex = items.findIndex(item => item.value === value)

	const geometry = {
		'--segments': items.length,
		'--index': Math.max(activeIndex, 0)
	} as CSSProperties

	return (
		<div
			role='group'
			aria-label={label}
			className={clsx(styles.root, size === 'large' && styles.large, className)}
			style={geometry}
		>
			{activeIndex >= 0 && <span className={styles.indicator} aria-hidden />}

			{items.map(item => {
				const active = item.value === value

				return (
					<RippleButton
						key={item.value}
						className={clsx(styles.option, active && styles.active)}
						aria-pressed={active}
						aria-label={item.ariaLabel}
						title={item.title ?? item.ariaLabel}
						onClick={() => onValueChange(item.value)}
					>
						{item.label}
					</RippleButton>
				)
			})}
		</div>
	)
}
