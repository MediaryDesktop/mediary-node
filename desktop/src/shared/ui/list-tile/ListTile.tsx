import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'

import styles from './ListTile.module.scss'

export interface ListTileProps {
	icon: IconName
	title: ReactNode
	subtitle?: ReactNode
	titleHint?: string
	subtitleHint?: string
	actions?: ReactNode
	as?: 'div' | 'li'
	className?: string
}

export function ListTile({
	icon,
	title,
	subtitle,
	titleHint,
	subtitleHint,
	actions,
	as: Tag = 'div',
	className
}: ListTileProps) {
	return (
		<Tag className={clsx(styles.tile, className)}>
			<span className={styles.icon}>
				<Icon name={icon} size={18} />
			</span>

			<div className={styles.body}>
				<p className={styles.title} title={titleHint}>
					{title}
				</p>
				{subtitle != null && (
					<p className={styles.subtitle} title={subtitleHint}>
						{subtitle}
					</p>
				)}
			</div>

			{actions != null && <div className={styles.actions}>{actions}</div>}
		</Tag>
	)
}
