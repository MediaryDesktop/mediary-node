import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import {type SetupStepId, SETUP_STEPS } from '../../config'

import styles from './SetupStepRail.module.scss'

export interface SetupStepRailProps {
	current: SetupStepId
	onSelect?: (step: SetupStepId) => void
}

export function SetupStepRail({ current, onSelect }: SetupStepRailProps) {
	const { t } = useTranslation()
	const currentIndex = SETUP_STEPS.findIndex(step => step.id === current)

	return (
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
						disabled={!onSelect || index > currentIndex}
						onClick={() => onSelect?.(step.id)}
					>
						<span className={styles.badge}>
							<Icon name={step.icon} size={24} />
						</span>

						<span className={styles.label}>{t(step.labelKey)}</span>
					</button>
				)
			})}
		</nav>
	)
}
