import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { ProgressBar, ReelLoader } from '@shared/ui'

import { libraryModel, libraryScanQuery } from '@entities/library-item'
import type { ScanActivity } from '@entities/library-item'

import { PHASE_LABELS, progressOf } from '../../lib/progress'

import styles from './ScanProgress.module.scss'

export function ScanProgress() {
	const { t } = useTranslation()

	const [activity, scanData] = useUnit([libraryModel.$activity, libraryScanQuery.$data])

	if (activity === null) {
		return null
	}

	const percent = progressOf(activity, scanData?.scan ?? null)

	return (
		<>
			<div className={styles.bar}>
				<ProgressBar
					value={percent ?? 0}
					max={percent === null ? null : 100}
					label={t('library.scan.title')}
				/>
			</div>

			<div className={styles.card} role='status'>
				<ReelLoader spinning />

				<p className={styles.line}>
					{percent === null ? '' : `${percent}% — `}
					{statusLine(activity)}
				</p>
			</div>
		</>
	)

	function statusLine(current: ScanActivity) {
		return [
			t(PHASE_LABELS[current.phase]),
			current.rootsTotal > 0
				? t('library.scan.roots', { count: current.rootsTotal, done: current.rootsDone })
				: null
		]
			.filter(Boolean)
			.join(' · ')
	}
}
