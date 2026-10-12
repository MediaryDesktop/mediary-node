import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon } from '@shared/ui'

import type { LibraryScanRunDetail } from '@entities/library-item'

import { filterGroups, folderOf, matchesSearch } from '../../lib/scan-history'
import { FileLogItem } from '../file-log-item/FileLogItem'

import { ScannedGroup } from './scanned-group/ScannedGroup'
import styles from './ScanRun.module.scss'

export interface ScanRunProps {
	run: LibraryScanRunDetail
	// Trimmed and lowercased.
	search: string
	// Opens the explorer on a folder.
	onExplore: (folder: string) => void
}

// One scan: what it could not match first, then each title it matched files to.
export function ScanRun({ run, search, onExplore }: ScanRunProps) {
	const { t } = useTranslation()

	const unmatched = useMemo(
		() => (run.unmatched_files ?? []).filter(log => matchesSearch(log, search)),
		[run, search]
	)

	const groups = useMemo(() => filterGroups(run.groups ?? [], search), [run, search])

	return (
		<section className={styles.card}>
			<header className={styles.cardHeader}>
				<p className={styles.muted}>
					{t('library.history.scanned', { count: run.groups?.length ?? 0 })}
				</p>

				{run.status === 'partial' && <Badge tone='warning'>{t('library.history.partial')}</Badge>}
			</header>

			{(run.unmatched_files?.length ?? 0) > 0 && (
				<p className={styles.warning}>
					<Icon name='common/info' size={16} />
					{t('library.history.notMatched', { count: run.unmatched_files?.length ?? 0 })}
				</p>
			)}

			{unmatched.length > 0 && (
				<div className={styles.section}>
					<h4 className={styles.heading}>{t('library.history.unmatchedTitle')}</h4>

					<div className={styles.logs}>
						{unmatched.map(log => (
							<FileLogItem key={log.rel_path} log={log} matched={false} search={search} />
						))}
					</div>
				</div>
			)}

			{groups.length > 0 && (
				<div className={styles.section}>
					<h4 className={styles.heading}>{t('library.history.matchedTitle')}</h4>

					<ul className={styles.groups}>
						{groups.map(group => (
							<ScannedGroup
								key={group.media_ref}
								group={group}
								search={search}
								onExplore={() => onExplore(folderOf(group.files?.[0]?.rel_path ?? ''))}
							/>
						))}
					</ul>
				</div>
			)}

			{unmatched.length === 0 && groups.length === 0 && (
				<p className={styles.muted}>{t('library.history.nothingToShow')}</p>
			)}
		</section>
	)
}
