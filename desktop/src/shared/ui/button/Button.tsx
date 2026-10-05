import clsx from 'clsx'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import { useRipple } from '../ripple/useRipple'

import styles from './Button.module.scss'

export type ButtonVariant =
	'primary' | 'secondary' | 'control' | 'glass' | 'glass-accent' | 'ghost' | 'chrome' | 'chrome-close'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	variant?: ButtonVariant
	size?: 'default' | 'small'
	fullWidth?: boolean
	iconOnly?: boolean
	loading?: boolean
	startIcon?: ReactNode
	endIcon?: ReactNode
	disableRipple?: boolean
	children?: ReactNode
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
	return (node: T | null) => {
		for (const ref of refs) {
			if (typeof ref === 'function') {
				ref(node)
			} else if (ref) {
				;(ref as { current: T | null }).current = node
			}
		}
	}
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = 'secondary',
		size = 'default',
		fullWidth = false,
		iconOnly = false,
		loading = false,
		startIcon,
		endIcon,
		disableRipple = false,
		children,
		className,
		disabled,
		type = 'button',
		...props
	},
	forwardedRef
) {
	const inactive = Boolean(disabled || loading)
	const ripple = useRipple<HTMLButtonElement>({ disabled: inactive || disableRipple })

	return (
		<button
			{...props}
			ref={mergeRefs(ripple, forwardedRef)}
			type={type}
			disabled={inactive}
			className={clsx(
				styles.button,
				styles[variant],
				size === 'small' && styles.small,
				fullWidth && styles.fullWidth,
				iconOnly && styles.iconOnly,
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
})
