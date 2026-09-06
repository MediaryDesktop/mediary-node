import clsx from 'clsx'

import styles from './logo.module.scss'

export interface LogoProps {
	iconSize?: number
	textSize?: number
	markOnly?: boolean
	className?: string
}

export function Logo({ iconSize = 50, textSize = 25, markOnly = false, className }: LogoProps) {
	return (
		<span className={clsx(styles.root, className)}>
			<img
				className={styles.mark}
				src='./logo/web-app-manifest-192x192.png'
				width={iconSize}
				height={iconSize}
				alt={markOnly ? 'Mediary' : ''}
			/>

			{!markOnly && (
				<span className={styles.wordmark} style={{ fontSize: textSize }}>
					Mediary
				</span>
			)}
		</span>
	)
}
