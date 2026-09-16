import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'

import styles from './Modal.module.scss'

export interface ModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	size?: 'sm' | 'md' | 'lg'
	children?: ReactNode
	footer?: ReactNode
}

export function Modal({ open, onOpenChange, title, description, size = 'md', children, footer }: ModalProps) {
	const { t } = useTranslation()

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay} />

				<Dialog.Content className={clsx(styles.content, styles[size])}>
					<header className={styles.header}>
						<Dialog.Title className={styles.title}>{title}</Dialog.Title>

						<Dialog.Close className={styles.close} aria-label={t('window.close')}>
							<Icon name='common/close' size={18} />
						</Dialog.Close>
					</header>

					{description ? (
						<Dialog.Description className={styles.description}>{description}</Dialog.Description>
					) : (
						<Dialog.Description className={styles.hidden}>{title}</Dialog.Description>
					)}

					{children && <div className={styles.body}>{children}</div>}

					{footer && <footer className={styles.footer}>{footer}</footer>}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
