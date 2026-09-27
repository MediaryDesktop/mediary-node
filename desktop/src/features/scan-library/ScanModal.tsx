import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'
import { Button, Icon, Modal, ProgressBar, ReelLoader } from '@shared/ui'

import { libraryModel, libraryRootsQuery, libraryScanQuery } from '@entities/library-item'
import type { LibraryScan, ScanActivity, ScanPhase } from '@entities/library-item'

import { scanLibraryModel } from './model'
import styles from './ScanModal.module.scss'

const PHASE_LABELS = {
	scanning: 'library.scan.walking',
	probing: 'library.scan.probing',
	matching: 'library.scan.matching'
} as const satisfies Record<ScanPhase, string>

// What the bar measures depends on the phase: folders while it walks them, then
// files while it reads their containers, then titles while it matches them.
function progressOf(activity: ScanActivity | null, scan: LibraryScan | null): number | null {
	if (activity === null) {
		return scan?.finished_at ? 100 : null
	}

	const [value, max] =
		activity.phase === 'scanning'
			? [activity.rootsDone, activity.rootsTotal]
			: [activity.done, activity.total]

	return max > 0 ? Math.round((Math.min(value, max) / max) * 100) : null
}

export function ScanModal() {
	const { t, i18n } = useTranslation()

	const [open, closed] = useUnit([scanLibraryModel.$open, scanLibraryModel.closed])
	const [scanData, rootsData] = useUnit([libraryScanQuery.$data, libraryRootsQuery.$data])
	const [activity, scanRequested] = useUnit([libraryModel.$activity, libraryModel.scanRequested])

	const scan = scanData?.scan ?? null
	const roots = rootsData?.roots ?? []

	const scanning = activity !== null || (scan?.running ?? false)
	const percent = progressOf(activity, scan)

	const failures = (scan?.roots ?? []).filter(root => root.error)

	const tally = [
		{ label: t('library.scan.tally.added'), count: scan?.added ?? 0 },
		{ label: t('library.scan.tally.changed'), count: scan?.changed ?? 0 },
		{ label: t('library.scan.tally.missing'), count: scan?.missing ?? 0 }
	]

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('library.scan.title')}
			size='md'
			footer={
				<Button
					variant='primary'
					startIcon={<Icon name='common/reset' size={16} />}
					disabled={scanning || roots.length === 0}
					onClick={() => scanRequested(0)}
				>
					{scanning ? t('library.scan.running') : t('library.scan.start')}
				</Button>
			}
		>
			<div className={styles.body}>
				<div className={styles.activity}>
					<ReelLoader spinning={scanning} />

					<div className={styles.status}>
						<p className={styles.phase}>
							{activity ? runningLine(activity) : idleLine(scan, i18n.language)}
						</p>

						<div className={styles.progress}>
							<ProgressBar
								value={percent ?? 0}
								max={percent === null ? null : 100}
								label={t('library.scan.title')}
								className={styles.bar}
							/>

							<span className={styles.percent}>{percent === null ? '—' : `${percent}%`}</span>
						</div>
					</div>
				</div>

				{roots.length === 0 ? (
					<p className={styles.hint}>{t('library.scan.noRoots')}</p>
				) : (
					<ul className={styles.tally}>
						{tally.map(line => (
							<li key={line.label} className={styles.line}>
								<span>{line.label}</span>
								<span className={styles.count}>{line.count}</span>
							</li>
						))}
					</ul>
				)}

				{failures.length > 0 && (
					<div className={styles.failures}>
						<p className={styles.failuresTitle}>
							<Icon name='common/info' size={14} />
							{t('library.scan.failedTitle')}
						</p>

						<ul className={styles.paths}>
							{failures.map(root => (
								<li key={root.path} className={styles.path} title={root.error ?? ''}>
									{root.path}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</Modal>
	)

	function runningLine(current: ScanActivity) {
		return [
			t(PHASE_LABELS[current.phase]),
			current.phase === 'scanning' && current.found > 0
				? t('library.scan.foundFiles', { count: current.found })
				: null,
			current.rootsTotal > 0
				? t('library.scan.roots', { count: current.rootsTotal, done: current.rootsDone })
				: null
		]
			.filter(Boolean)
			.join(' · ')
	}

	// Between scans the modal reports the last one rather than an empty bar with
	// no explanation: what it found, what it could name, and how long ago.
	function idleLine(last: LibraryScan | null, locale: string) {
		if (!last?.finished_at) {
			return t('library.scan.neverRun')
		}

		return [
			t('library.scan.finished', { when: formatRelativeTime(last.finished_at, locale) }),
			t('library.scan.foundFiles', { count: last.found }),
			t('library.scan.matchedFiles', { count: last.matched })
		].join(' · ')
	}
}
