import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import styles from './SectionCard.module.scss'

export interface SectionCardProps {
	icon: IconName
	title: string
	subtitle: string
	className?: string
	children: ReactNode
}

export function SectionCard({ icon, title, subtitle, className, children }: SectionCardProps) {
	return (
		<section className={clsx(styles.card, className)}>
			<header className={styles.head}>
				<span className={styles.icon}>
					<Icon name={icon} size={22} />
				</span>

				<div className={styles.heading}>
					<h3 className={styles.title}>{title}</h3>
					<p className={styles.subtitle}>{subtitle}</p>
				</div>
			</header>

			<div className={styles.body}>{children}</div>
		</section>
	)
}
