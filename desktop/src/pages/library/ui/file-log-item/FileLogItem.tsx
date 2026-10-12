import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Disclosure, Icon } from '@shared/ui'

import type { LibraryScanRunFileLog } from '@entities/library-item'

import styles from './FileLogItem.module.scss'
import { Highlighted } from './highlighted/Highlighted'

export interface FileLogItemProps {
	log: LibraryScanRunFileLog
	matched: boolean
	search: string
}

function nameOf(relPath: string): string {
	const parts = relPath.split('/')

	return parts[parts.length - 1] || relPath
}

// One file's line in the scanner log: the name, and on opening it what the scan
// read off the name and how close it came to a title.
export function FileLogItem({ log, matched, search }: FileLogItemProps) {
	const { t } = useTranslation()

	const percent = log.confidence != null ? Math.round(log.confidence * 100) : null

	return (
		<Disclosure
			className={styles.item}
			summary={
				<span className={clsx(styles.name, !matched && styles.warning)}>
					<Icon name={matched ? 'common/play' : 'common/info'} size={14} />
					<Highlighted text={nameOf(log.rel_path)} search={search} />
				</span>
			}
		>
			<div className={styles.body}>
				<code className={styles.path}>{log.rel_path}</code>

				{log.parsed_title && (
					<p className={styles.line}>
						{t('library.history.parsedTitle')} <strong>{log.parsed_title}</strong>
					</p>
				)}

				<p className={clsx(styles.line, matched ? styles.info : styles.warningText)}>
					{matched
						? t('library.history.logMatched', { percent: percent ?? 100 })
						: percent === null
							? t('library.history.logNothing')
							: t('library.history.logRejected', { percent })}
				</p>
			</div>
		</Disclosure>
	)
}
