import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Logo } from '@shared/ui'

import { SETUP_STEPS } from '../../config/steps'
import type { SetupStepId } from '../../config/steps'

import styles from './SetupLayout.module.scss'

export interface SetupLayoutProps {
	current: SetupStepId
	onSelectStep?: (step: SetupStepId) => void
	onBack?: () => void
	onNext?: () => void
	backDisabled?: boolean
	nextDisabled?: boolean
	nextLabel?: string
	caption?: ReactNode
	children: ReactNode
}

export function SetupLayout({
	current,
	onSelectStep,
	onBack,
	onNext,
	backDisabled = false,
	nextDisabled = false,
	nextLabel,
	caption,
	children
}: SetupLayoutProps) {
	const { t } = useTranslation()
	const currentIndex = SETUP_STEPS.findIndex(step => step.id === current)

	return (
		<div className={styles.page}>
			<div className={styles.glow} />

			<header className={styles.head}>
				<Logo markOnly />
				<p className={styles.note}>{t('setup.note')}</p>
			</header>

			<nav className={styles.rail} aria-label={t('setup.railLabel')}>
				{SETUP_STEPS.map((step, index) => {
					const active = index === currentIndex
					const done = index < currentIndex

					return (
						<button
							key={step.id}
							type='button'
							className={clsx(styles.step, active && styles.active, done && styles.done)}
							aria-current={active ? 'step' : undefined}
							disabled={!onSelectStep || index > currentIndex}
							onClick={() => onSelectStep?.(step.id)}
						>
							<span className={styles.badge}>
								<Icon name={step.icon} size={24} />
							</span>

							<span className={styles.label}>{t(step.labelKey)}</span>
						</button>
					)
				})}
			</nav>

			<main className={styles.content}>{children}</main>

			<div className={styles.footer}>
				<Button
					variant='ghost'
					disabled={backDisabled}
					onClick={onBack}
					startIcon={<Icon name='common/arrow-left' size={16} />}
				>
					{t('setup.previous')}
				</Button>

				<Button
					variant='primary'
					disabled={nextDisabled}
					onClick={onNext}
					endIcon={<Icon name='common/arrow-right' size={16} />}
				>
					{nextLabel ?? t('setup.next')}
				</Button>
			</div>

			{caption && <p className={styles.caption}>{caption}</p>}
		</div>
	)
}
