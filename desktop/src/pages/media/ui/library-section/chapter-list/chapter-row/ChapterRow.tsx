import clsx from 'clsx'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, DropdownMenu, Icon, RippleButton } from '@shared/ui'

import type { MangaDownload } from '@entities/manga-source'
import { LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow as Row } from '@entities/reader'

import styles from './ChapterRow.module.scss'

export interface ChapterRowProps {
	row: Row
	read: boolean
	accent: string | null
	onOpen: (option: ChapterOption) => void
	// A download of this chapter under way.
	download?: MangaDownload
	onSave?: () => void
}

// A chapter opens its nearest copy; the other copies wait behind the menu.
export function ChapterRow({ row, read, accent, onOpen, download, onSave }: ChapterRowProps) {
	const { t } = useTranslation()
	const [first, ...others] = row.options

	if (!first) {
		return null
	}

	return (
		<li className={styles.item}>
			<button
				type='button'
				className={clsx(styles.row, read && styles.read)}
				style={accent ? ({ '--accent-chapter': accent } as CSSProperties) : undefined}
				onClick={() => onOpen(first)}
			>
				<span className={styles.number}>
					{row.number === null ? '—' : t('reader.chapterNumber', { number: row.number })}
				</span>
				<span className={styles.name}>
					<span className={styles.nameText}>{first.title}</span>
					<span className={styles.file}>
						<span className={clsx(styles.source, first.source === LOCAL_SOURCE && styles.local)}>
							{first.sourceName}
						</span>{' '}
						· {first.detail}
					</span>
				</span>
				{read ? (
					<Badge tone='success'>{t('reader.read')}</Badge>
				) : (
					<Icon name='common/book-open' size={18} className={styles.open} />
				)}
			</button>

			{others.length > 0 && (
				<DropdownMenu
					items={others.map(option => ({
						id: option.ref,
						label: `${option.sourceName} · ${option.detail}`,
						icon: 'common/book-open',
						onSelect: () => onOpen(option)
					}))}
					trigger={
						<RippleButton
							className={styles.copies}
							aria-label={t('mangaSources.chapters.copies')}
							title={t('mangaSources.chapters.copies')}
						>
							<Icon name='common/more-vertical' size={16} />
						</RippleButton>
					}
				/>
			)}

			{download ? (
				<span className={styles.saving} role='status'>
					{download.state === 'running' && download.pages_total > 0
						? t('mangaSources.downloads.progress', {
								done: download.pages_done,
								total: download.pages_total
							})
						: t(`mangaSources.downloads.states.${download.state}`)}
				</span>
			) : (
				onSave && (
					<button
						type='button'
						className={styles.copies}
						aria-label={t('mangaSources.downloads.save')}
						title={t('mangaSources.downloads.save')}
						onClick={onSave}
					>
						<Icon name='common/download' size={16} />
					</button>
				)
			)}
		</li>
	)
}
