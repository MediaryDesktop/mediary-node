import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './AuthLink.module.scss'

export interface AuthLinkProps {
	onClick: () => void
	tone?: 'accent' | 'muted'
	disabled?: boolean
	className?: string
	children: ReactNode
}

export function AuthLink({ onClick, tone = 'accent', disabled = false, className, children }: AuthLinkProps) {
	return (
		<button
			type='button'
			className={clsx(styles.link, tone === 'muted' && styles.muted, className)}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	)
}
