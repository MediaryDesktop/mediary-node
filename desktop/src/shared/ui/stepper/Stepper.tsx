import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'

import styles from './Stepper.module.scss'

export interface StepperProps {
	value: ReactNode
	onDecrement: () => void
	onIncrement: () => void
	disabled?: boolean
	decrementDisabled?: boolean
	incrementDisabled?: boolean
	decrementLabel?: string
	incrementLabel?: string
	className?: string
}

export function Stepper({
	value,
	onDecrement,
	onIncrement,
	disabled = false,
	decrementDisabled = false,
	incrementDisabled = false,
	decrementLabel,
	incrementLabel,
	className
}: StepperProps) {
	const { t } = useTranslation()

	return (
		<div className={clsx(styles.stepper, className)}>
			<button
				type='button'
				className={styles.step}
				disabled={disabled || decrementDisabled}
				aria-label={decrementLabel ?? t('lists.decrement')}
				onClick={onDecrement}
			>
				−
			</button>

			<span className={styles.value}>{value}</span>

			<button
				type='button'
				className={styles.step}
				disabled={disabled || incrementDisabled}
				aria-label={incrementLabel ?? t('lists.increment')}
				onClick={onIncrement}
			>
				+
			</button>
		</div>
	)
}
