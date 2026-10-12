import clsx from 'clsx'
import type { ReactNode } from 'react'
import { TiMinus, TiPlus } from 'react-icons/ti'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'

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
			<Button
				size='small'
				disabled={disabled || decrementDisabled}
				aria-label={decrementLabel ?? t('lists.decrement')}
				onClick={onDecrement}
				startIcon={<TiMinus size={14}></TiMinus>}
			></Button>

			<span className={styles.value}>{value}</span>

			<Button
				size='small'
				disabled={disabled || incrementDisabled}
				aria-label={incrementLabel ?? t('lists.increment')}
				onClick={onIncrement}
				startIcon={<TiPlus size={14}></TiPlus>}
			></Button>
		</div>
	)
}
