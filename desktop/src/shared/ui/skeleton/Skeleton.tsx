import clsx from 'clsx'
import type { CSSProperties } from 'react'

import styles from './Skeleton.module.scss'

export interface SkeletonProps {
	width?: CSSProperties['width']
	height?: CSSProperties['height']
	radius?: CSSProperties['borderRadius']
	className?: string
}

export function Skeleton({ width, height = '1rem', radius, className }: SkeletonProps) {
	return (
		<span
			aria-hidden
			className={clsx(styles.skeleton, className)}
			style={{ width, height, borderRadius: radius }}
		/>
	)
}
