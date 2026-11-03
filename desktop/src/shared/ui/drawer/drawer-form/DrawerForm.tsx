import clsx from 'clsx'
import type { FormEvent, ReactNode } from 'react'

import { useTranslation } from '../../../i18n'
import { Button } from '../../button/Button'

import styles from './DrawerForm.module.scss'

export interface DrawerFormProps {
	children: ReactNode
	onSubmit: () => void
	onCancel: () => void
	submitLabel: string
	cancelLabel?: string
	submitDisabled?: boolean
	cancelDisabled?: boolean
	submitting?: boolean
	className?: string
	// False for a form mounted inline in the page (a settings card's own
	// expanding body) rather than in a Drawer's fixed-height panel: the content
	// then grows with the page instead of scrolling inside itself.
	scrollable?: boolean
}

export function DrawerForm({
	children,
	onSubmit,
	onCancel,
	submitLabel,
	cancelLabel,
	submitDisabled = false,
	cancelDisabled = false,
	submitting = false,
	className,
	scrollable = true
}: DrawerFormProps) {
	const { t } = useTranslation()

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSubmit()
	}

	return (
		<form className={clsx(styles.form, className)} onSubmit={handleSubmit}>
			<div className={clsx(styles.content, !scrollable && styles.static)}>{children}</div>

			<div className={styles.actions}>
				<Button variant='secondary' onClick={onCancel} disabled={cancelDisabled}>
					{cancelLabel ?? t('common.cancel')}
				</Button>

				<Button type='submit' variant='primary' disabled={submitDisabled} loading={submitting}>
					{submitLabel}
				</Button>
			</div>
		</form>
	)
}
