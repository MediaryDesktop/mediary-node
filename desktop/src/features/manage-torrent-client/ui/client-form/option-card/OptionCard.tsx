import clsx from 'clsx'
import type { ReactNode } from 'react'

import { CollapsibleSection, RadioDot, renderIcon } from '@shared/ui'
import type { IconLike } from '@shared/ui'

import styles from './OptionCard.module.scss'

export interface OptionCardProps {
	icon: IconLike
	title: string
	description: string
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	detail?: ReactNode
}

export function OptionCard({
	icon,
	title,
	description,
	selected,
	disabled,
	onSelect,
	detail
}: OptionCardProps) {
	return (
		<div className={clsx(styles.option, selected && styles.selected)}>
			<button
				type='button'
				role='radio'
				aria-checked={selected}
				disabled={disabled}
				className={styles.head}
				onClick={onSelect}
			>
				<span className={styles.badge}>{renderIcon(icon, 20)}</span>

				<span className={styles.body}>
					<span className={styles.title}>{title}</span>
					<span className={styles.description}>{description}</span>
				</span>

				<RadioDot selected={selected} />
			</button>

			{detail != null && (
				<CollapsibleSection open={selected}>
					<div className={styles.detail}>{detail}</div>
				</CollapsibleSection>
			)}
		</div>
	)
}
