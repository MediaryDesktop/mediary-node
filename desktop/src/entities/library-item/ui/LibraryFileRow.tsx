import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon, Tooltip } from '@shared/ui'
import type { IconName } from '@shared/ui'

import type { LibraryFile, LibraryMediaForm } from '../api/api'
import { fileNumber, fileTitle } from '../model/model'

import styles from './LibraryFileRow.module.scss'

const FORM_ICONS: Record<LibraryMediaForm, IconName> = {
	series: 'categories/series',
	movie: 'categories/movie',
	special: 'common/sparkles',
	extra: 'common/play',
	manga: 'categories/manga',
	book: 'categories/book'
}

export interface LibraryFileRowProps {
	file: LibraryFile
	playing?: boolean
	onPlay?: (file: LibraryFile) => void
	onMatch?: (file: LibraryFile) => void
	onClearMatch?: (file: LibraryFile) => void
}

export function LibraryFileRow({ file, playing, onPlay, onMatch, onClearMatch }: LibraryFileRowProps) {
	const { t } = useTranslation()

	const form = file.parsed.form
	const number = fileNumber(file)
	const match = file.match

	return (
		<article className={clsx(styles.row, playing && styles.playing)}>
			{onPlay && file.kind === 'video' && !file.missing ? (
				<Tooltip content={t('library.file.play')}>
					<button
						type='button'
						className={styles.play}
						aria-label={t('library.file.play')}
						onClick={() => onPlay(file)}
					>
						<Icon name='common/play' size={16} />
					</button>
				</Tooltip>
			) : (
				<Icon name={form ? FORM_ICONS[form] : 'common/database'} size={20} className={styles.icon} />
			)}

			<div className={styles.body}>
				<p className={styles.title}>
					{fileTitle(file)}
					{number !== null && <span className={styles.number}>#{number}</span>}
				</p>

				<Tooltip content={file.path}>
					<p className={styles.path}>{file.rel_path}</p>
				</Tooltip>
			</div>

			<div className={styles.meta}>
				{file.missing && <Badge tone='danger'>{t('library.file.missing')}</Badge>}

				{form && <Badge tone='neutral'>{t(`library.form.${form}`)}</Badge>}

				{match ? (
					<Badge tone={match.source === 'manual' ? 'info' : 'success'}>
						{match.source === 'manual'
							? t('library.file.matchedByHand')
							: t('library.file.matched', { percent: Math.round(match.confidence * 100) })}
					</Badge>
				) : (
					form !== 'extra' && <Badge tone='warning'>{t('library.file.unmatched')}</Badge>
				)}

				{onMatch && form !== 'extra' && (
					<button type='button' className={styles.action} onClick={() => onMatch(file)}>
						{match ? t('library.file.change') : t('library.file.match')}
					</button>
				)}

				{onClearMatch && match && (
					<button
						type='button'
						className={styles.action}
						aria-label={t('library.file.clear')}
						onClick={() => onClearMatch(file)}
					>
						<Icon name='common/close' size={14} />
					</button>
				)}
			</div>
		</article>
	)
}
