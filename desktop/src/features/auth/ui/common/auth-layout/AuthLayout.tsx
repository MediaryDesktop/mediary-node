import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { pinTheme } from '@shared/style/theme'
import { Icon, Logo } from '@shared/ui'

import styles from './AuthLayout.module.scss'

export interface AuthLayoutProps {
	children: ReactNode
	onBack?: () => void
}

export function AuthLayout({ children, onBack }: AuthLayoutProps) {
	const { t } = useTranslation()

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

			<div className={styles.card}>{children}</div>

			{onBack && (
				<button type='button' className={styles.back} onClick={onBack}>
					<Icon name='common/arrow-left' size={16} />
					{t('auth.back')}
				</button>
			)}
		</div>
	)
}
