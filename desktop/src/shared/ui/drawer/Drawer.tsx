import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'

import styles from './Drawer.module.scss'

export interface DrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: ReactNode
	headerAction?: ReactNode
	side?: 'right' | 'left' | 'bottom'
	size?: 'sm' | 'md' | 'lg'
	children?: ReactNode
}

export function Drawer({
	open,
	onOpenChange,
	title,
	description,
	headerAction,
	side = 'right',
	size = 'md',
	children
}: DrawerProps) {
	const { t } = useTranslation()

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay} />

				<Dialog.Content
					className={clsx(styles.panel, styles[side], styles[size])}
					aria-describedby={undefined}
				>
					<header className={styles.header}>
						<div className={styles.titleRow}>
							<Dialog.Title className={styles.title}>{title}</Dialog.Title>

							{headerAction && <div className={styles.headerAction}>{headerAction}</div>}

							<Dialog.Close className={styles.close} aria-label={t('window.close')}>
								<Icon name='common/close' size={18} />
							</Dialog.Close>
						</div>

						{description && <p className={styles.description}>{description}</p>}
					</header>

					<div className={styles.body}>{children}</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
