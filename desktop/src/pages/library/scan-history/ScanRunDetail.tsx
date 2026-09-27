import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatDateTime } from '@shared/lib'
import { Drawer, Icon } from '@shared/ui'

import { libraryScanRunQuery } from '@entities/library-item'

import { ScanRunGroupRow } from './ScanRunGroupRow'
import styles from './ScanRunDetail.module.scss'

export interface ScanRunDetailProps {
	runId: number | null
	onClose: () => void
}

export function ScanRunDetail({ runId, onClose }: ScanRunDetailProps) {
	const { t, i18n } = useTranslation()

	const [runResponse, pending, startRun] = useUnit([
		libraryScanRunQuery.$data,
		libraryScanRunQuery.$pending,
		libraryScanRunQuery.start
	])

	useEffect(() => {
		if (runId !== null) {
			startRun(runId)
		}
	}, [runId, startRun])

	const open = runId !== null
	const run = runResponse?.run
	const shown = open && run?.id === runId ? run : null

	const tally = shown
		? [
				t('library.summary.files', { count: shown.found }),
				t('library.scan.matchedFiles', { count: shown.matched })
			].join(' · ')
		: undefined

	const groups = shown?.groups ?? []
	const unmatchedFiles = shown?.unmatched_files ?? []

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={shown ? formatDateTime(shown.started_at, i18n.language) : t('library.history.title')}
			description={tally}
			size='lg'
		>
			{!shown ? (
				pending && <p className={styles.loading}>{t('library.loading')}</p>
			) : (
				<div className={styles.sections}>
					{groups.length > 0 && (
						<section className={styles.section}>
							<h3 className={styles.heading}>{t('library.history.matchedTitle')}</h3>

							<ul className={styles.groups}>
								{groups.map(group => (
									<ScanRunGroupRow key={group.media_ref} group={group} />
								))}
							</ul>
						</section>
					)}

					{unmatchedFiles.length > 0 && (
						<section className={styles.section}>
							<h3 className={styles.heading}>{t('library.history.unmatchedTitle')}</h3>

							<ul className={styles.files}>
								{unmatchedFiles.map(file => (
									<li key={file.file_id ?? file.rel_path} className={styles.file}>
										<Icon name='common/info' size={14} />

										<span className={styles.path} title={file.rel_path}>
											{file.rel_path}
										</span>

										{file.confidence != null && (
											<span className={styles.confidence}>
												{Math.round(file.confidence * 100)}%
											</span>
										)}
									</li>
								))}
							</ul>
						</section>
					)}

					{groups.length === 0 && unmatchedFiles.length === 0 && (
						<p className={styles.loading}>{t('library.history.nothingToShow')}</p>
					)}
				</div>
			)}
		</Drawer>
	)
}
