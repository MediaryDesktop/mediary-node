import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

import { useTranslation } from '../../i18n'
import { Badge } from '../badge/Badge'
import { Icon } from '../icon/Icon'

import styles from './PageHeader.module.scss'

export interface PageHeaderCrumb {
	label: string
	onSelect?: () => void
}

export interface PageHeaderTab {
	key: string
	label: ReactNode
	badge?: ReactNode
	active?: boolean
	onSelect?: () => void
}

export interface PageHeaderProps {
	title: ReactNode
	icon?: ReactNode
	subtitle?: ReactNode
	breadcrumbs?: PageHeaderCrumb[]
	tabs?: PageHeaderTab[]
	rightContent?: ReactNode
	className?: string
	children?: ReactNode
}

export function PageHeader({
	title,
	icon,
	subtitle,
	breadcrumbs,
	tabs,
	rightContent,
	className,
	children
}: PageHeaderProps) {
	const { t } = useTranslation()

	const trail = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : null
	const hasTabs = tabs && tabs.length > 0
	const activeKey = tabs?.find(tab => tab.active)?.key

	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
	const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

	useLayoutEffect(() => {
		const updateIndicator = () => {
			const node = activeKey ? tabRefs.current[activeKey] : null
			setIndicator(node ? { left: node.offsetLeft, width: node.offsetWidth } : null)
		}

		const frame = requestAnimationFrame(updateIndicator)

		window.addEventListener('resize', updateIndicator)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('resize', updateIndicator)
		}
	}, [activeKey, tabs?.length])

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

				<div className={styles.titleGroup}>
					<h1 className={styles.title}>{title}</h1>
					{subtitle && <span className={styles.subtitle}>{subtitle}</span>}
				</div>

				{rightContent && <div className={styles.rightContent}>{rightContent}</div>}
			</div>

			{hasTabs && (
				<nav className={styles.tabs} aria-label={t('common.sections')}>
					{tabs.map(tab => (
						<button
							key={tab.key}
							ref={node => {
								tabRefs.current[tab.key] = node
							}}
							type='button'
							className={clsx(styles.tab, tab.active && styles.tabActive)}
							aria-current={tab.active ? 'page' : undefined}
							onClick={tab.onSelect}
						>
							{tab.label}

							{tab.badge != null && (
								<Badge size='sm' className={styles.tabBadge}>
									{tab.badge}
								</Badge>
							)}
						</button>
					))}

					{indicator && (
						<span
							className={styles.indicator}
							style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
						/>
					)}
				</nav>
			)}

			{children && <div className={styles.content}>{children}</div>}
		</header>
	)
}
