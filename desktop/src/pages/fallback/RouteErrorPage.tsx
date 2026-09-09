import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Button } from '@shared/ui'

import styles from './Fallback.module.scss'

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>{t('fallback.error.title')}</h1>
			<p className={styles.description}>{t('fallback.error.description')}</p>

			{error.message && <pre className={styles.detail}>{error.message}</pre>}

			<div className={styles.actions}>
				<Button size='small' onClick={reset}>
					{t('fallback.error.retry')}
				</Button>

				<Link to='/' className={styles.link}>
					{t('fallback.notFound.home')}
				</Link>
			</div>
		</div>
	)
}
