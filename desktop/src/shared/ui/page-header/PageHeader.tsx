import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'

import styles from './PageHeader.module.scss'

export interface PageHeaderCrumb {
	label: string
	onSelect?: () => void
}

export interface PageHeaderProps {
	title: ReactNode
	icon?: ReactNode
	subtitle?: ReactNode
	breadcrumbs?: PageHeaderCrumb[]
	rightContent?: ReactNode
	className?: string
	children?: ReactNode
}

export function PageHeader({
	title,
	icon,
	subtitle,
	breadcrumbs,
	rightContent,
	className,
	children
}: PageHeaderProps) {
	const { t } = useTranslation()

	const trail = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : null

	return (
		<header className={clsx(styles.header, className)}>
			{trail && (
				<nav className={styles.breadcrumbs} aria-label={t('common.breadcrumbs')}>
					{trail.map((crumb, index) => (
						<span key={index} className={styles.crumbGroup}>
							{index > 0 && (
								<Icon
									name='common/chevron-down'
									size={14}
									className={styles.crumbSeparator}
								/>
							)}

							{crumb.onSelect ? (
								<button type='button' className={styles.crumb} onClick={crumb.onSelect}>
									{crumb.label}
								</button>
							) : (
								<span className={clsx(styles.crumb, styles.crumbCurrent)}>{crumb.label}</span>
							)}
						</span>
					))}
				</nav>
			)}

			<div className={styles.topRow}>
				{icon && <span className={styles.icon}>{icon}</span>}

				<h1 className={styles.title}>{title}</h1>

				{rightContent && <div className={styles.rightContent}>{rightContent}</div>}
			</div>

			{(subtitle || children) && (
				<div className={clsx(styles.content, icon && styles.withIcon)}>
					{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
					{children}
				</div>
			)}
		</header>
	)
}
