import type { ReactNode } from 'react'

import styles from './AuthLink.module.scss'

export interface AuthLinkProps {
	onClick: () => void
	disabled?: boolean
	children: ReactNode
}

export function AuthLink({ onClick, disabled = false, children }: AuthLinkProps) {
	return (
		<button type='button' className={styles.link} disabled={disabled} onClick={onClick}>
			{children}
		</button>
	)
}
