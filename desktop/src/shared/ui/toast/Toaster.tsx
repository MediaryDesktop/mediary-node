import type { ComponentProps } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

import styles from './toast.module.scss'

export interface ToasterProps {
	theme?: ComponentProps<typeof SonnerToaster>['theme']
}

export function Toaster({ theme }: ToasterProps) {
	return (
		<SonnerToaster
			theme={theme}
			position='bottom-right'
			gap={10}
			visibleToasts={6}
			toastOptions={{
				unstyled: true,
				classNames: {
					toast: styles.toast,
					title: styles.title,
					description: styles.description,
					icon: styles.icon,
					closeButton: styles.closeButton,
					success: styles.success,
					error: styles.error,
					warning: styles.warning,
					info: styles.info
				}
			}}
		/>
	)
}
