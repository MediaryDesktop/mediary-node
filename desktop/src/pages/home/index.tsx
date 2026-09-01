import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button } from '@shared/ui'

import { $nodeReady, nodeHealthQuery } from '@infra/node'

import { sessionModel } from '@entities/session'

import styles from './HomePage.module.scss'

export function HomePage() {
	const { t } = useTranslation()
	const [ready, data, pending, error, account, signOut] = useUnit([
		$nodeReady,
		nodeHealthQuery.$data,
		nodeHealthQuery.$pending,
		nodeHealthQuery.$error,
		sessionModel.$account,
		sessionModel.signOutRequested
	])

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>Mediary</h1>
			<p className={styles.subtitle}>{t('home.subtitle')}</p>

			<section className={styles.panel}>
				<h2 className={styles.panelTitle}>{t('home.account.title')}</h2>

				{account ? (
					<div className={styles.accountRow}>
						<div>
							<p className={styles.accountName}>{account.display_name}</p>
							<p className={styles.muted}>{account.email}</p>
						</div>

						<Button size='small' onClick={() => signOut()}>
							{t('home.account.signOut')}
						</Button>
					</div>
				) : (
					<div className={styles.accountRow}>
						<p className={styles.muted}>{t('home.account.anonymous')}</p>

						<Link to='/sign-in' className={styles.signIn}>
							{t('home.account.signIn')}
						</Link>
					</div>
				)}
			</section>

			<section className={styles.panel}>
				<h2 className={styles.panelTitle}>{t('home.node.title')}</h2>

				{!ready && <p className={styles.muted}>{t('home.node.waiting')}</p>}

				{ready && pending && <p className={styles.muted}>{t('home.node.pending')}</p>}

				{error && <p className={styles.error}>{t('home.node.failed', { error: String(error) })}</p>}

				{data && (
					<dl className={styles.facts}>
						<dt>{t('home.node.version')}</dt>
						<dd>{data.version}</dd>

						<dt>{t('home.node.build')}</dt>
						<dd>{data.commit}</dd>

						<dt>{t('home.node.linkedLabel')}</dt>
						<dd>{data.linked ? t('home.node.linked') : t('home.node.notLinked')}</dd>
					</dl>
				)}
			</section>
		</div>
	)
}
