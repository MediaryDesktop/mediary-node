import clsx from 'clsx'
import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { pinTheme } from '@shared/style/theme'
import { Icon, Logo, SLIDE_CONTENT_CLASS, SLIDE_FRAME_CLASS } from '@shared/ui'

import styles from './AuthLayout.module.scss'

type BackHandler = () => void

const AuthBackContext = createContext<(handler: BackHandler | null) => void>(() => {})

export interface AuthLayoutProps {
	children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
	const { t } = useTranslation()
	const [onBack, setOnBack] = useState<BackHandler | null>(null)

	const registerBack = useCallback((handler: BackHandler | null) => setOnBack(() => handler), [])

	useLayoutEffect(() => pinTheme('dark'), [])

	return (
		<div className={styles.page}>
			<video
				className={styles.video}
				src='./video/hero-bg.webm'
				autoPlay
				loop
				muted
				playsInline
				aria-hidden
				tabIndex={-1}
			/>
			<div className={styles.scrim} />

			<Logo className={styles.brand} />

			<section className={styles.copy}>
				<h1 className={styles.headline}>
					{t('auth.pitch.titleLead')}
					<br />
					<span className={styles.headlineAccent}>{t('auth.pitch.titleAccent')}</span>
				</h1>

				<p className={styles.tagline}>{t('auth.pitch.tagline')}</p>

				<p className={styles.aside}>{t('auth.pitch.aside')}</p>
			</section>

			<div className={clsx(styles.card, SLIDE_FRAME_CLASS)}>
				<div className={clsx(styles.content, SLIDE_CONTENT_CLASS)}>
					<AuthBackContext value={registerBack}>{children}</AuthBackContext>
				</div>
			</div>

			{onBack && (
				<button type='button' className={styles.back} onClick={onBack}>
					<Icon name='common/arrow-left' size={16} />
					{t('auth.back')}
				</button>
			)}
		</div>
	)
}

export function useAuthBack(handler: BackHandler) {
	const register = useContext(AuthBackContext)

	useLayoutEffect(() => {
		register(handler)

		return () => register(null)
	}, [register, handler])
}
