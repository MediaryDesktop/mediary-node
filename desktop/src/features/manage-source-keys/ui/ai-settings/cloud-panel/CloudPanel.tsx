import { Link } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Icon, ProgressBar } from '@shared/ui'

import type { AISettings as Settings } from '@entities/media'

import styles from '../AIPanel.module.scss'

export function CloudPanel({ settings }: { settings: Settings }) {
	const { t } = useTranslation()
	const cloud = settings.cloud

	if (!cloud.linked) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.notLinked')}</p>

				<Link to='/settings' search={{ section: 'backup' }} className={styles.link}>
					<Icon name='common/user' size={15} />
					{t('ai.cloud.pair')}
				</Link>

				<p className={styles.note}>{t('ai.cloud.privacy')}</p>
			</div>
		)
	}

	if (!cloud.known) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.unknown')}</p>
				<p className={styles.note}>{t('ai.cloud.privacy')}</p>
			</div>
		)
	}

	if (!cloud.enabled) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.unavailable')}</p>
			</div>
		)
	}

	const renews = cloud.resets_at
		? new Date(cloud.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		: null

	return (
		<div className={styles.panel}>
			<div className={styles.quota}>
				<div className={styles.quotaHead}>
					<span className={styles.state}>
						{t('ai.cloud.remaining', { remaining: cloud.remaining, limit: cloud.limit })}
					</span>
					{renews && (
						<span className={styles.quotaMeta}>{t('ai.cloud.renews', { time: renews })}</span>
					)}
				</div>

				<ProgressBar value={cloud.used} max={cloud.limit} label={t('ai.providers.cloud')} />
			</div>

			<p className={styles.note}>{t('ai.cloud.privacy')}</p>
		</div>
	)
}
