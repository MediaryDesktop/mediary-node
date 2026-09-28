import { useTranslation } from '@shared/i18n'
import { Badge, Button, Icon } from '@shared/ui'

import { fileDuration, fileNumber, fileSeason, isMatched } from '@entities/library-item'
import type { LibraryFile, LibraryTitle } from '@entities/library-item'

import styles from './DetailPanel.module.scss'
import type { TreeNode } from './lib/build-tree'

export interface DetailPanelProps {
	node: TreeNode | null
	titles: LibraryTitle[]

	onMatch: (file: LibraryFile) => void
	onIgnore: (file: LibraryFile, ignored: boolean) => void
	onDelete: (file: LibraryFile) => void
}

function formatSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']

	let value = bytes
	let unit = 0

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}

	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function DetailPanel({ node, titles, onMatch, onIgnore, onDelete }: DetailPanelProps) {
	const { t } = useTranslation()

	if (node === null) {
		return (
			<aside className={styles.panel}>
				<p className={styles.hint}>{t('library.explorer.pickSomething')}</p>
			</aside>
		)
	}

	if (node.kind === 'folder') {
		return (
			<aside className={styles.panel}>
				<p className={styles.name}>{node.name}</p>
				<p className={styles.path}>{node.key.replace(/^root:\d+/, '')}</p>

				<dl className={styles.facts}>
					<Fact label={t('library.explorer.files')} value={String(node.files)} />
					<Fact label={t('library.group.matched')} value={String(node.matched)} />
				</dl>
			</aside>
		)
	}

	const file = node.file
	const season = fileSeason(file)
	const number = fileNumber(file)
	const duration = fileDuration(file)
	const title = titles.find(entry => entry.media_ref === file.match?.media_ref)

	return (
		<aside className={styles.panel}>
			<p className={styles.name}>{node.name}</p>
			<p className={styles.path}>{file.path}</p>

			<div className={styles.badges}>
				{isMatched(file) ? (
					<Badge tone='success' icon='common/check'>
						{t('library.group.matched')}
					</Badge>
				) : (
					<Badge tone='warning' icon='common/info'>
						{t('library.group.unmatched')}
					</Badge>
				)}

				{file.missing && <Badge tone='danger'>{t('library.file.missing')}</Badge>}
				{file.ignored && <Badge>{t('library.file.ignored')}</Badge>}
			</div>

			<dl className={styles.facts}>
				{title && <Fact label={t('library.explorer.matchedTitle')} value={title.title} />}
				{season !== null && <Fact label={t('library.explorer.season')} value={String(season)} />}
				{number !== null && <Fact label={t('library.explorer.episode')} value={String(number)} />}
				{duration && <Fact label={t('library.explorer.duration')} value={duration} />}
				<Fact label={t('library.explorer.size')} value={formatSize(file.size_bytes)} />
				<Fact label={t('library.explorer.kind')} value={file.kind} />
			</dl>

			<div className={styles.actions}>
				<Button
					size='small'
					startIcon={<Icon name='common/link' size={14} />}
					onClick={() => onMatch(file)}
				>
					{file.match ? t('library.file.change') : t('library.file.match')}
				</Button>

				<Button
					size='small'
					startIcon={<Icon name={file.ignored ? 'common/eye' : 'common/eye-off'} size={14} />}
					onClick={() => onIgnore(file, !file.ignored)}
				>
					{file.ignored ? t('library.file.unignore') : t('library.file.ignore')}
				</Button>

				<Button
					size='small'
					startIcon={<Icon name='common/trash' size={14} />}
					onClick={() => onDelete(file)}
				>
					{t('library.file.deleteFile')}
				</Button>
			</div>
		</aside>
	)
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className={styles.fact}>
			<dt>{label}</dt>
			<dd>{value}</dd>
		</div>
	)
}
