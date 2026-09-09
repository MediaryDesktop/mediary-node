import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import {
	SETUP_STEPS,
	SetupAccountStep,
	SetupDebridStep,
	SetupDownloadingStep,
	SetupLayout,
	SetupLibraryStep,
	SetupPlayerStep
} from '@features/setup-wizard'
import type { SetupStepId } from '@features/setup-wizard'

import styles from './SetupPage.module.scss'

export function SetupPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [index, setIndex] = useState(0)

	const step = SETUP_STEPS[index]!
	const isLast = index === SETUP_STEPS.length - 1

	const goTo = useCallback(
		(id: SetupStepId) => setIndex(SETUP_STEPS.findIndex(candidate => candidate.id === id)),
		[]
	)

	const goBack = useCallback(() => setIndex(current => Math.max(0, current - 1)), [])

	const goNext = useCallback(() => {
		if (isLast) {
			navigate({ to: '/' })
			return
		}

		setIndex(current => current + 1)
	}, [isLast, navigate])

	return (
		<SetupLayout
			current={step.id}
			onSelectStep={goTo}
			onBack={goBack}
			onNext={goNext}
			backDisabled={index === 0}
			nextLabel={isLast ? t('setup.finish') : undefined}
			caption={t('setup.progress', { current: index + 1, total: SETUP_STEPS.length })}
		>
			<section className={styles.panel}>
				<header className={styles.header}>
					<h1 className={styles.title}>{t(step.titleKey)}</h1>
					<p className={styles.description}>{t(step.descriptionKey)}</p>
				</header>

				<div className={styles.content}>
					{step.id === 'account' && <SetupAccountStep />}
					{step.id === 'library' && <SetupLibraryStep />}
					{step.id === 'player' && <SetupPlayerStep />}
					{step.id === 'downloads' && <SetupDownloadingStep />}
					{step.id === 'debrid' && <SetupDebridStep />}
				</div>
			</section>
		</SetupLayout>
	)
}
