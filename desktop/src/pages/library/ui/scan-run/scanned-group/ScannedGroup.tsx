import { Link } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Button, Disclosure, Icon } from '@shared/ui'

import type { LibraryScanRunGroup } from '@entities/library-item'

import { matchesSearch } from '../../../lib/scan-history'
import { FileLogItem } from '../../file-log-item/FileLogItem'
import styles from '../ScanRun.module.scss'

export interface ScannedGroupProps {
	group: LibraryScanRunGroup
	search: string
	onExplore: () => void
}

// A title the scan matched files to, with those files' scanner logs folded away.
export function ScannedGroup({ group, search, onExplore }: ScannedGroupProps) {
	const { t } = useTranslation()

	const files = group.files ?? []
	const title = group.title?.title ?? group.media_ref

	return (
		<li className={styles.group}>
			<div className={styles.groupMain}>
				<div
					className={styles.cover}
					style={{ backgroundColor: group.title?.cover_color ?? undefined }}
				>
					{group.title?.cover_image && <img src={group.title.cover_image} alt='' loading='lazy' />}
				</div>

				<div className={styles.groupBody}>
					<Link
						className={styles.groupTitle}
						to='/media/$mediaRef'
						params={{ mediaRef: group.media_ref }}
					>
						{title}
					</Link>

					<p className={group.tracked ? styles.tracked : styles.untracked}>
						<Icon name={group.tracked ? 'common/check' : 'common/close'} size={14} />
						{group.tracked
							? t('library.history.onYourList')
							: t('library.history.notYetOnYourList')}
					</p>

					<p className={styles.muted}>
						{t('library.history.filesScanned', { count: group.file_count })}
					</p>

					<div>
						<Button
							variant='ghost'
							size='small'
							startIcon={<Icon name='common/folder-tree' size={14} />}
							onClick={onExplore}
						>
							{t('library.history.openExplorer')}
						</Button>
					</div>
				</div>
			</div>

			{files.length > 0 && (
				<Disclosure
					className={styles.scannerLogs}
					summary={t('library.history.scannerLogs')}
					defaultOpen={search !== '' && files.some(log => matchesSearch(log, search))}
				>
					<div className={styles.logs}>
						{files.map(log => (
							<FileLogItem key={log.rel_path} log={log} matched search={search} />
						))}
					</div>
				</Disclosure>
			)}
		</li>
	)
}
