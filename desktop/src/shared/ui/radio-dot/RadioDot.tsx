import clsx from 'clsx'

import styles from './RadioDot.module.scss'

export interface RadioDotProps {
	selected: boolean
	className?: string
}

// The circle indicator for a custom single-pick control (an option card, a
// service tile) that is not a native radio input — purely visual, so the
// selection itself is announced through the control's own aria-checked.
export function RadioDot({ selected, className }: RadioDotProps) {
	return (
		<span className={clsx(styles.radio, selected && styles.selected, className)} aria-hidden='true'>
			{selected && <span className={styles.dot} />}
		</span>
	)
}
