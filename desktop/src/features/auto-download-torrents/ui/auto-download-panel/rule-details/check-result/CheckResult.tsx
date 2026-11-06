import { useTranslation } from '@shared/i18n'

import type { TorrentRuleCheck } from '@entities/torrent'

import { checkCounts, episodeLabel } from '../../../../lib/check-summary'
import styles from '../RuleDetails.module.scss'
import { Status } from '../status/Status'

export interface CheckResultProps {
	check: TorrentRuleCheck
	preview: boolean
}

export function CheckResult({ check, preview }: CheckResultProps) {
	const { t } = useTranslation()

	const planned = check.planned ?? []
	const counts = checkCounts(check)

	return (
		<Status
			tone={check.error ? 'danger' : preview && planned.length > 0 ? 'info' : 'success'}
			icon={check.error ? 'common/info' : preview && planned.length > 0 ? 'common/eye' : 'common/check'}
			title={
				planned.length === 0
					? t('torrents.auto.nothing')
					: preview
						? t('torrents.auto.wouldAdd', { count: counts.planned })
						: t('torrents.auto.added', { count: counts.added })
			}
		>
			{check.error && <p className={styles.problem}>{check.error}</p>}
			{planned.length > 0 && (
				<ul className={styles.planned}>
					{planned.map(item => (
						<li key={item.release.id}>
							<span className={styles.episode}>{episodeLabel(item.episodes ?? [], t)}</span>
							<span className={styles.release} title={item.release.title}>
								{item.release.title}
							</span>
						</li>
					))}
				</ul>
			)}
		</Status>
	)
}
