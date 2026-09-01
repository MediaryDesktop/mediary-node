import clsx from 'clsx'

import styles from './logo.module.scss'

export interface LogoProps {
	size?: number
	markOnly?: boolean
	className?: string
}

export function Logo({ size = 32, markOnly = false, className }: LogoProps) {
	return (
		<span className={clsx(styles.root, className)}>
			<img
				className={styles.mark}
				src='./logo/web-app-manifest-192x192.png'
				width={size}
				height={size}
				alt={markOnly ? 'Mediary' : ''}
			/>

			{!markOnly && <span className={styles.wordmark}>Mediary</span>}
		</span>
	)
}
