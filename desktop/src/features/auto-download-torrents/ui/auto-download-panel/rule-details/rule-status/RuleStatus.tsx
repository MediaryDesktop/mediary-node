import { useTranslation } from '@shared/i18n'

import type { TorrentRule } from '@entities/torrent'

import { Status } from '../status/Status'

export interface RuleStatusProps {
	rule: TorrentRule
	setupMissing: boolean
}

export function RuleStatus({ rule, setupMissing }: RuleStatusProps) {
	const { t } = useTranslation()

	if (!rule.enabled) {
		return (
			<Status tone='neutral' icon='common/pause' title={t('torrents.auto.status.paused')}>
				<p>{t('torrents.auto.status.pausedHint')}</p>
			</Status>
		)
	}

	if (rule.last_error && !setupMissing) {
		return (
			<Status tone='danger' icon='common/info' title={t('torrents.auto.status.failed')}>
				<p>{rule.last_error}</p>
			</Status>
		)
	}

	if (!rule.last_checked) {
		return (
			<Status tone='info' icon='common/clock' title={t('torrents.auto.status.pending')}>
				<p>{t('torrents.auto.status.pendingHint')}</p>
			</Status>
		)
	}

	if (rule.last_added > 0) {
		return (
			<Status
				tone='success'
				icon='common/check'
				title={t('torrents.auto.status.added', { count: rule.last_added })}
			>
				<p>{t('torrents.auto.status.addedHint')}</p>
			</Status>
		)
	}

	return (
		<Status tone='success' icon='common/check' title={t('torrents.auto.status.caughtUp')}>
			<p>{t('torrents.auto.status.caughtUpHint')}</p>
		</Status>
	)
}
