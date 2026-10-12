import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Badge, Button, Icon } from '@shared/ui'

import { fileDuration, fileNumber, fileSeason, isMatched } from '@entities/library-item'
import type { LibraryTitle } from '@entities/library-item'

import type { TreeNode } from '../../lib/build-tree'

import styles from './DetailPanel.module.scss'

export interface DetailPanelProps {
	node: TreeNode | null
	titles: LibraryTitle[]
	// Opens a book in the reader; matched or not, a book on disk can be read.
	onRead?: (fileId: number) => void
}

function extensionOf(name: string): string {
	const dot = name.lastIndexOf('.')

	return dot > 0 ? name.slice(dot + 1).toUpperCase() : ''
}

export function DetailPanel({ node, titles, onRead }: DetailPanelProps) {
	const { t } = useTranslation()

	if (node === null) {
		return (
			<aside className={styles.panel}>
				<p className={styles.hint}>{t('library.explorer.pickSomething')}</p>
			</aside>
		)
	}

	const folder = node.kind === 'folder'
	const file = folder ? null : node.file
	const extension = folder ? '' : extensionOf(node.name)
	const title = file ? titles.find(entry => entry.media_ref === file.match?.media_ref) : undefined

	return (
		<aside className={styles.panel}>
			<section className={styles.card}>
				<span className={styles.bigIcon}>
					<Icon name={folder ? 'common/folder' : 'common/database'} size={24} />
				</span>

				<p className={styles.name}>{node.name}</p>

				{extension && (
					<span className={styles.chip}>{t('library.explorer.extension', { extension })}</span>
				)}

				{onRead && file?.kind === 'book' && !file.missing && (
					<Button
						size='small'
						startIcon={<Icon name='common/book-open' size={16} />}
						onClick={() => onRead(file.id)}
					>
						{t('reader.book.read')}
					</Button>
				)}
			</section>

			<section className={styles.card}>
				<Field label={t('library.explorer.kind')}>
					{folder
						? t('library.explorer.folder')
						: t(`library.explorer.kinds.${file?.kind ?? 'video'}`)}
				</Field>

				<Field label={t('library.explorer.path')}>
					<code className={styles.path}>
						{file ? file.path : node.key.replace(/^root:\d+\/?/, '')}
					</code>
				</Field>

				{folder ? (
					<div className={styles.grid}>
						<Field label={t('library.explorer.files')}>{node.files}</Field>
						<Field label={t('library.group.matched')}>{node.matched}</Field>
					</div>
				) : (
					file && (
						<>
							<Field label={t('library.explorer.libraryFile')} inline>
								<span className={styles.badges}>
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
								</span>
							</Field>

							<div className={styles.grid}>
								<Field label={t('library.explorer.season')}>{fileSeason(file) ?? '—'}</Field>
								<Field label={t('library.explorer.episode')}>{fileNumber(file) ?? '—'}</Field>
								<Field label={t('library.explorer.duration')}>
									{fileDuration(file) ?? '—'}
								</Field>
								<Field label={t('library.explorer.size')}>
									{formatBytes(file.size_bytes)}
								</Field>
							</div>

							{file.parsed.form && (
								<Field label={t('library.explorer.form')}>
									<span className={styles.form}>{file.parsed.form}</span>
								</Field>
							)}
						</>
					)
				)}
			</section>

			{title && (
				<section className={styles.media}>
					{title.cover_image ? (
						<img src={title.cover_image} alt='' loading='lazy' />
					) : (
						<span
							className={styles.cover}
							style={{ background: title.cover_color ?? undefined }}
						/>
					)}

					<p className={styles.mediaTitle}>{title.title}</p>
				</section>
			)}
		</aside>
	)
}

function Field({ label, inline, children }: { label: string; inline?: boolean; children: ReactNode }) {
	return (
		<div className={clsx(styles.field, inline && styles.inline)}>
			<dt>{label}</dt>
			<dd>{children}</dd>
		</div>
	)
}
