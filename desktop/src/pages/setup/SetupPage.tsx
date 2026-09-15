import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { SLIDE_CONTENT_CLASS, startSlideTransition } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'

import { ConnectAniList } from '@features/connect-anilist'
import {
	SETUP_STEPS,
	SetupAccountStep,
	SetupAniListStep,
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

	const [aniListConnected, aniListAuthorizeUrl] = useUnit([
		aniListAccountModel.$connected,
		aniListAccountModel.$authorizeUrl
	])

	const needsAniList = step.id === 'anilist' && !aniListConnected && aniListAuthorizeUrl !== null

	const goTo = useCallback(
		(id: SetupStepId) => {
			const target = SETUP_STEPS.findIndex(candidate => candidate.id === id)

			if (target === index) {
				return
			}

			startSlideTransition(target < index ? 'back' : 'forward', () => setIndex(target), 'setup')
		},
		[index]
	)

	const goBack = useCallback(() => {
		if (index === 0) {
			return
		}

		startSlideTransition('back', () => setIndex(current => Math.max(0, current - 1)), 'setup')
	}, [index])

	const goNext = useCallback(() => {
		if (isLast) {
			navigate({ to: '/' })
			return
		}

		startSlideTransition('forward', () => setIndex(current => current + 1), 'setup')
	}, [isLast, navigate])

	return (
		<SetupLayout
			current={step.id}
			onSelectStep={goTo}
			onBack={goBack}
			onNext={goNext}
			backDisabled={index === 0}
			nextDisabled={needsAniList}
			nextLabel={isLast ? t('setup.finish') : undefined}
			caption={t('setup.progress', { current: index + 1, total: SETUP_STEPS.length })}
		>
			<section className={clsx(styles.panel, SLIDE_CONTENT_CLASS)}>
				<header className={styles.header}>
					<h1 className={styles.title}>{t(step.titleKey)}</h1>
					<p className={styles.description}>{t(step.descriptionKey)}</p>
				</header>

				<div className={styles.content}>
					{step.id === 'anilist' && (
						<SetupAniListStep connect={<ConnectAniList showHeader={false} />} />
					)}
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
