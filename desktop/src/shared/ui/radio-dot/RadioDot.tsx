import clsx from 'clsx'

import styles from './RadioDot.module.scss'

export interface RadioDotProps {
	selected: boolean
	className?: string
}

export function RadioDot({ selected, className }: RadioDotProps) {
	return (
		<span className={clsx(styles.radio, selected && styles.selected, className)} aria-hidden='true'>
			{selected && <span className={styles.dot} />}
		</span>
	)
}
