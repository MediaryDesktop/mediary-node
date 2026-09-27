import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'
import { Icon, ProgressBar } from '@shared/ui'

import type { LibraryScan, ScanActivity, ScanPhase } from '@entities/library-item'

import { ReelLoader } from './reel-loader/ReelLoader'
import styles from './ScanPanel.module.scss'

// How many unreadable folders the panel lists before it offers the rest. A drive
// that went away takes every folder on it with it, and a list of forty paths
// would push the library off the screen.
const PREVIEW_FAILURES = 2

const PHASE_LABELS = {
	scanning: 'library.scan.walking',
	probing: 'library.scan.probing',
	matching: 'library.scan.matching'
} as const satisfies Record<ScanPhase, string>

export interface ScanPanelProps {
	activity: ScanActivity | null
	scan: LibraryScan | null
	total: number
	unmatched: number
}

interface Failure {
	path: string
	reason: string
}

function failedRoots(scan: LibraryScan | null): Failure[] {
	return (scan?.roots ?? [])
		.filter(root => root.error)
		.map(root => ({ path: root.path, reason: root.error ?? '' }))
}

// What the bar measures depends on the phase: folders while it walks them, then
// files while it reads their containers, then titles while it matches them. A
// finished scan is a full bar, and one that never ran is an empty one — the panel
// stays on the page either way, so it has to say something true while idle.
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

export function ScanPanel({ activity, scan, total, unmatched }: ScanPanelProps) {
	const { t, i18n } = useTranslation()

	const [showAll, setShowAll] = useState(false)

	const failures = failedRoots(scan)

	const shown = showAll ? failures : failures.slice(0, PREVIEW_FAILURES)
	const rest = failures.length - shown.length

	const percent = progressOf(activity, scan)

	const stats = [
		t('library.summary.files', { count: total }),
		t('library.summary.unmatched', { count: unmatched }),
		t('library.scan.matchedFiles', { count: scan?.matched ?? 0 })
	].join(' · ')

	// What the last scan changed. It fills the column that the unreadable folders
	// would otherwise own, so the panel keeps its shape whether or not anything
	// went wrong — and it answers the question a scan raises: what moved?
	const tally = [
		{ label: t('library.scan.tally.added'), count: scan?.added ?? 0 },
		{ label: t('library.scan.tally.changed'), count: scan?.changed ?? 0 },
		{ label: t('library.scan.tally.missing'), count: scan?.missing ?? 0 }
	]

	return (
		<section className={styles.panel}>
			<div className={styles.activity}>
				<div className={styles.loader}>
					<ReelLoader spinning={activity !== null} />
				</div>
				
				<div className={styles.body}>
					<p className={styles.title}>{t('library.scan.title')}</p>

					<p className={styles.stats}>{stats}</p>

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

			<div className={styles.aside}>
				{failures.length > 0 ? (
					<>
						<p className={clsx(styles.asideTitle, styles.bad)}>
							<Icon name='common/info' size={16} />
							{t('library.scan.failedTitle')}
						</p>

						<ul className={styles.paths}>
							{shown.map(failure => (
								<li key={failure.path} className={styles.path} title={failure.reason}>
									{failure.path}
								</li>
							))}
						</ul>

						{(rest > 0 || showAll) && (
							<button
								type='button'
								className={styles.expand}
								onClick={() => setShowAll(current => !current)}
							>
								{showAll
									? t('library.scan.showLess')
									: t('library.scan.showMore', { count: rest })}

								<Icon
									name='common/chevron-down'
									size={14}
									className={clsx(styles.chevron, showAll && styles.up)}
								/>
							</button>
						)}
					</>
				) : (
					<>
						<p className={clsx(styles.asideTitle, styles.good)}>
							<Icon name='common/check' size={16} />
							{t('library.scan.allRead')}
						</p>

						<ul className={styles.tally}>
							{tally.map(line => (
								<li key={line.label} className={styles.line}>
									<span>{line.label}</span>
									<span className={styles.count}>{line.count}</span>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</section>
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

	// Between scans the panel reports the last one rather than an empty bar with
	// no explanation: what it found, what it could name, and how long ago.
	function idleLine(last: LibraryScan | null, locale: string) {
		if (!last?.finished_at) {
			return t('library.scan.neverRun')
		}

		return t('library.scan.finished', { when: formatRelativeTime(last.finished_at, locale) })
	}
}
