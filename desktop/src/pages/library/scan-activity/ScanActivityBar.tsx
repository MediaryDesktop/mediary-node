import { useTranslation } from '@shared/i18n'
import { Icon, ProgressBar } from '@shared/ui'

import type { LibraryScan, ScanActivity } from '@entities/library-item'

import styles from './ScanActivityBar.module.scss'

export interface ScanActivityBarProps {
	activity: ScanActivity | null
	scan: LibraryScan | null
}

function failedRoots(scan: LibraryScan | null): string[] {
	return (scan?.roots ?? []).filter(root => root.error).map(root => root.error ?? '')
}

export function ScanActivityBar({ activity, scan }: ScanActivityBarProps) {
	const { t } = useTranslation()

	const failures = failedRoots(scan)

	if (!activity && failures.length === 0) {
		return null
	}

	return (
		<div className={styles.bar}>
			{activity && (
				<div className={styles.activity}>
					<div className={styles.line}>
						<Icon name='common/reset' size={16} className={styles.spinner} />

						<span className={styles.label}>
							{activity.phase === 'matching'
								? t('library.scan.matching', {
										matched: activity.matched,
										total: activity.total
									})
								: t('library.scan.walking', { found: activity.found })}
						</span>
					</div>

					{activity.phase === 'matching' && activity.total > 0 && (
						<ProgressBar value={activity.matched} max={activity.total} />
					)}
				</div>
			)}

			{failures.map(failure => (
				<p key={failure} className={styles.failure}>
					<Icon name='common/info' size={16} />
					{t('library.scan.rootFailed', { reason: failure })}
				</p>
			))}
		</div>
	)
}
