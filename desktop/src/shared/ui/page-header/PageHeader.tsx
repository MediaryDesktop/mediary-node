import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

import styles from './PageHeader.module.scss'

export interface PageHeaderProps {
	title: ReactNode
	subtitle?: ReactNode
	onBack?: () => void
	backLabel?: string
	rightContent?: ReactNode
	className?: string
	children?: ReactNode
}

export function PageHeader({
	title,
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
			{onBack && (
				<nav className={styles.navigation} aria-label='Page navigation'>
					<Button
						type='button'
						onClick={onBack}
						variant='control'
						size='small'
						iconOnly
						startIcon={<Icon name='common/arrow-left' size={20} />}
						aria-label={backLabel ?? t('media.back')}
						className={styles.backButton}
					/>
				</nav>
			)}

			<div className={styles.content}>
				<h1 className={styles.title}>{title}</h1>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
				{children}
			</div>

			{rightContent && <div className={styles.rightContent}>{rightContent}</div>}
		</header>
	)
}
