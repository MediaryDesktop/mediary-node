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
	closable?: boolean
	side?: 'right' | 'left' | 'bottom'
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'sheet'
	children?: ReactNode
	// Where focus lands on open. Radix selects the text of a field it focuses; a
	// caller that wants the caret without the selection takes over here.
	onOpenAutoFocus?: (event: Event) => void
}

export function Drawer({
	open,
	onOpenChange,
	title,
	description,
	headerAction,
	closable = true,
	side = 'right',
	size = 'md',
	children,
	onOpenAutoFocus
}: DrawerProps) {
	const { t } = useTranslation()

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay} />

				<Dialog.Content
					className={clsx(styles.panel, styles[side], styles[size])}
					aria-describedby={undefined}
					onOpenAutoFocus={onOpenAutoFocus}
					onInteractOutside={event => {
						// A select's list lives on the body, outside the drawer; picking from it
						// is still working inside the drawer.
						if (
							event.target instanceof Element &&
							event.target.closest('[data-floating-panel]')
						) {
							event.preventDefault()
						}
					}}
					onEscapeKeyDown={event => {
						// An open popup inside the drawer closes itself on Escape; the drawer
						// stays. Radix listens on the document, so it hears the key first.
						if (
							event.target instanceof Element &&
							event.target.closest('[data-handles-escape]')
						) {
							event.preventDefault()
						}
					}}
				>
					<header className={styles.header}>
						<div className={styles.titleRow}>
							<Dialog.Title className={styles.title}>{title}</Dialog.Title>

							{headerAction && <div className={styles.headerAction}>{headerAction}</div>}

							{closable && (
								<Dialog.Close className={styles.close} aria-label={t('window.close')}>
									<Icon name='common/close' size={18} />
								</Dialog.Close>
							)}
						</div>

						{description && <p className={styles.description}>{description}</p>}
					</header>

					<div className={styles.body}>{children}</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
