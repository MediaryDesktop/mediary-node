import clsx from 'clsx'
import { forwardRef } from 'react'
import type { ReactNode } from 'react'

import { RippleButton } from '../ripple/RippleButton'
import type { RippleButtonProps } from '../ripple/RippleButton'
import { Tooltip } from '../tooltip/Tooltip'

import styles from './ItemCard.module.scss'

export type ItemCardHighlight = 'success' | 'warning'

export interface ItemCardProps {
	icon: ReactNode
	title: string
	titleHint?: string
	subtitle?: ReactNode
	description?: string
	meta?: ReactNode[]
	badge?: ReactNode
	actions?: ReactNode
	highlight?: ItemCardHighlight
	muted?: boolean
	className?: string
	children?: ReactNode
}

export function ItemCard({
	icon,
	title,
	titleHint,
	subtitle,
	description,
	meta = [],
	badge,
	actions,
	highlight,
	muted = false,
	className,
	children
}: ItemCardProps) {
	const facts = meta.filter(Boolean)

	return (
		<article
			className={clsx(styles.card, highlight && styles[highlight], muted && styles.muted, className)}
		>
			<div className={styles.head}>
				<span className={styles.icon}>{icon}</span>

				<div className={styles.titles}>
					<p className={styles.title} title={titleHint}>
						{title}
					</p>
					{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
				</div>

				{actions && <div className={styles.actions}>{actions}</div>}
			</div>

			{description && <p className={styles.description}>{description}</p>}

			{children}

			{(facts.length > 0 || badge) && (
				<div className={styles.footer}>
					<div className={styles.meta}>
						{facts.map((fact, index) => (
							<span key={index}>{fact}</span>
						))}
					</div>

					{badge}
				</div>
			)}
		</article>
	)
}

export type ItemCardActionTone = 'default' | 'primary' | 'success'

export interface ItemCardActionProps extends RippleButtonProps {
	label: string
	tone?: ItemCardActionTone
	tooltip?: boolean
}

export const ItemCardAction = forwardRef<HTMLButtonElement, ItemCardActionProps>(function ItemCardAction(
	{ label, tone = 'default', tooltip = true, className, children, ...props },
	ref
) {
	const button = (
		<RippleButton
			{...props}
			ref={ref}
			aria-label={label}
			className={clsx(styles.action, styles[tone], className)}
		>
			{children}
		</RippleButton>
	)

	if (!tooltip) {
		return button
	}

	return (
		<Tooltip content={label} side='left'>
			{button}
		</Tooltip>
	)
})

export interface ItemCardMarkProps {
	label: string
	children: ReactNode
}

export function ItemCardMark({ label, children }: ItemCardMarkProps) {
	return (
		<Tooltip content={label} side='left'>
			<span className={clsx(styles.action, styles.mark)} tabIndex={0} aria-label={label}>
				{children}
			</span>
		</Tooltip>
	)
}
