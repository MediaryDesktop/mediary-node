import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

import styles from './PageHeader.module.scss'

export interface PageHeaderProps {
	title: ReactNode
	icon?: ReactNode
	subtitle?: ReactNode
	onBack?: () => void
	backLabel?: string
	rightContent?: ReactNode
	className?: string
	children?: ReactNode
}

export function PageHeader({
	title,
	icon,
	subtitle,
	onBack,
	backLabel,
	rightContent,
	className,
	children
}: PageHeaderProps) {
	const { t } = useTranslation()

	return (
		<header className={clsx(styles.header, className)}>
			<div className={styles.topRow}>
				{onBack && (
					<nav className={styles.navigation} aria-label='Page navigation'>
						<Button
							type='button'
							onClick={onBack}
							variant='control'
							size='small'
							iconOnly
							aria-label={backLabel ?? t('media.back')}
							className={styles.backButton}
						>
							<Icon name='common/arrow-left' size={20} />
						</Button>
					</nav>
				)}

				{icon && <span className={styles.icon}>{icon}</span>}

				<h1 className={styles.title}>{title}</h1>

				{rightContent && <div className={styles.rightContent}>{rightContent}</div>}
			</div>

			{(subtitle || children) && (
				<div className={clsx(styles.content, onBack && styles.withBack, icon && styles.withIcon)}>
					{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
					{children}
				</div>
			)}
		</header>
	)
}
