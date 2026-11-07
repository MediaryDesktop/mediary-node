import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Badge, Button, Icon } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { fileName, titleFilesQuery } from '@entities/library-item'

import styles from './BookFiles.module.scss'

export interface BookFilesProps {
	mediaRef: string
}

function formatOf(name: string): string {
	const lower = name.toLowerCase()
	if (lower.endsWith('.fb2.zip')) {
		return 'FB2'
	}

	const dot = lower.lastIndexOf('.')

	return dot > 0 ? lower.slice(dot + 1).toUpperCase() : ''
}

export function BookFiles({ mediaRef }: BookFilesProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [data] = useUnit([titleFilesQuery.$data])

	useNodeData(titleFilesQuery, { params: { mediaRef, kind: 'book' } })

	const files = (data?.files.items ?? []).filter(
		file => file.kind === 'book' && file.match?.media_ref === mediaRef
	)

	if (files.length === 0) {
		return null
	}

	return (
		<section className={styles.section}>
			<h2 className={styles.title}>{t('media.books.title')}</h2>

			<ul className={styles.list}>
				{files.map((file, index) => {
					const name = fileName(file)

					return (
						<li key={file.id} className={styles.row}>
							<span className={styles.icon} aria-hidden>
								<Icon name='categories/book' size={18} />
							</span>

							<div className={styles.body}>
								<p className={styles.name} title={file.path}>
									{name}
								</p>
								<span className={styles.meta}>
									{[formatOf(name), formatBytes(file.size_bytes)]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</div>

							{file.missing ? (
								<Badge tone='danger'>{t('library.file.missing')}</Badge>
							) : (
								<Button
									size='small'
									variant={index === 0 ? 'primary' : 'secondary'}
									startIcon={<Icon name='common/book-open' size={16} />}
									onClick={() =>
										void navigate({
											to: '/read-book/$fileId',
											params: { fileId: String(file.id) }
										})
									}
								>
									{t('reader.book.read')}
								</Button>
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}
