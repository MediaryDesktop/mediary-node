import { Link } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'

import styles from './Fallback.module.scss'

export function NotFoundPage() {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<p className={styles.code}>404</p>
			<h1 className={styles.title}>{t('fallback.notFound.title')}</h1>
			<p className={styles.description}>{t('fallback.notFound.description')}</p>

			<div className={styles.actions}>
				<Link to='/' className={styles.link}>
					{t('fallback.notFound.home')}
				</Link>
			</div>
		</div>
	)
}
