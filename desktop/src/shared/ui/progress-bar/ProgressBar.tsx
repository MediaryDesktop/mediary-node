import clsx from 'clsx'

import styles from './ProgressBar.module.scss'

export interface ProgressBarProps {
	value: number
	max: number | null | undefined
	label?: string
	className?: string
}

export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
	const known = typeof max === 'number' && max > 0
	const ratio = known ? Math.min(Math.max(value / max, 0), 1) : 0

	return (
		<div
			role='progressbar'
			aria-label={label}
			aria-valuemin={0}
			aria-valuenow={value}
			aria-valuemax={known ? max : undefined}
			className={clsx(styles.track, !known && styles.unknown, className)}
		>
			<span className={styles.fill} style={{ width: `${ratio * 100}%` }} />
		</div>
	)
}
