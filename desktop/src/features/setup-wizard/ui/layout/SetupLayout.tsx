import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Logo, renderIcon } from '@shared/ui'

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

			<div className={styles.railRow}>
				<Button
					className={styles.railNav}
					variant='ghost'
					iconOnly
					disabled={backDisabled}
					onClick={onBack}
					aria-label={t('setup.previous')}
				>
					<Icon name='common/arrow-left' size={20} />
				</Button>

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
								<span className={styles.badge}>{renderIcon(step.icon, 24)}</span>

								<span className={styles.label}>{t(step.labelKey)}</span>
							</button>
						)
					})}
				</nav>

				<Button
					className={styles.railNav}
					variant='ghost'
					iconOnly
					disabled={nextDisabled}
					onClick={onNext}
					aria-label={nextLabel ?? t('setup.next')}
				>
					<Icon name='common/arrow-right' size={20} />
				</Button>
			</div>

			<main className={styles.content}>{children}</main>
		</div>
	)
}
