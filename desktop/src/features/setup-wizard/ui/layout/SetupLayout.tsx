import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Logo, WindowControls } from '@shared/ui'

import styles from './SetupLayout.module.scss'

export interface SetupLayoutProps {
	rail: ReactNode
	children: ReactNode
	footer: ReactNode
	caption?: ReactNode
}

export function SetupLayout({ rail, children, footer, caption }: SetupLayoutProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.page}>
			<div className={styles.dragStrip} />
			<WindowControls className={styles.windowControls} />
			<div className={styles.glow} />

			<header className={styles.head}>
				<Logo markOnly />
				<p className={styles.note}>{t('setup.note')}</p>
			</header>

			{rail}

			<main className={styles.content}>{children}</main>

			<div className={styles.footer}>{footer}</div>

			{caption && <p className={styles.caption}>{caption}</p>}
		</div>
	)
}
