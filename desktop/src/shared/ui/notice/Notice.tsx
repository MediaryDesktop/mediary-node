import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Button } from '../button/Button'
import type { ButtonVariant } from '../button/Button'
import { Icon } from '../icon/Icon'

import styles from './Notice.module.scss'

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success'

const ACTION_VARIANT: Record<NoticeTone, ButtonVariant> = {
	info: 'glass-info',
	warning: 'glass-warning',
	danger: 'glass-danger',
	success: 'glass-success'
}

// The tone-matched Button variant for a Notice's action, for callers that
// need to build the button themselves (e.g. with a router Link).
export function noticeActionVariant(tone: NoticeTone): ButtonVariant {
	return ACTION_VARIANT[tone]
}

export interface NoticeProps {
	tone?: NoticeTone
	title?: ReactNode
	children?: ReactNode
	// The common case: one button, tone-matched automatically. For anything
	// else (a link, two buttons, custom markup) pass `action` instead.
	actionLabel?: ReactNode
	onAction?: () => void
	action?: ReactNode
	className?: string
}

export function Notice({
	tone = 'info',
	title,
	children,
	actionLabel,
	onAction,
	action,
	className
}: NoticeProps) {
	const resolvedAction =
		action ??
		(actionLabel != null && onAction != null && (
			<Button size='small' variant={ACTION_VARIANT[tone]} onClick={onAction}>
				{actionLabel}
			</Button>
		))

	return (
		<div
			className={clsx(styles.notice, styles[tone], className)}
			role={tone === 'danger' ? 'alert' : 'status'}
		>
			<span className={styles.icon}>
				<Icon name='common/info' size={18} />
			</span>

			<div className={styles.body}>
				{title != null && <p className={styles.title}>{title}</p>}
				{children != null && <div className={styles.text}>{children}</div>}
			</div>

			{resolvedAction ? <div className={styles.action}>{resolvedAction}</div> : null}
		</div>
	)
}
