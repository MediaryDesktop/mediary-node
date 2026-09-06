import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'glass-accent' | 'ghost'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	variant?: ButtonVariant
	size?: 'default' | 'small'
	fullWidth?: boolean
	loading?: boolean
	startIcon?: ReactNode
	endIcon?: ReactNode
	children?: ReactNode
}

export function Button({
	variant = 'secondary',
	size = 'default',
	fullWidth = false,
	loading = false,
	startIcon,
	endIcon,
	children,
	className,
	disabled,
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			{...props}
			type={type}
			disabled={disabled || loading}
			className={clsx(
				styles.button,
				styles[variant],
				size === 'small' && styles.small,
				fullWidth && styles.fullWidth,
				className
			)}
		>
			{loading ? (
				<span className={styles.spinner} />
			) : (
				startIcon && <span className={styles.icon}>{startIcon}</span>
			)}

			{children}

			{endIcon && !loading && <span className={styles.icon}>{endIcon}</span>}
		</button>
	)
}
