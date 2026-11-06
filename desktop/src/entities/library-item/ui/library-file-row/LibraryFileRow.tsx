import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Badge, DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem, IconName } from '@shared/ui'

import type { LibraryFile, LibraryMediaForm } from '../../api/api'
import { fileDuration, fileName, fileNumber, fileSeason } from '../../lib/file'

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
	onIgnore?: (file: LibraryFile, ignored: boolean) => void
	onDelete?: (file: LibraryFile) => void
}

export function LibraryFileRow({
	file,
	playing,
	onPlay,
	onMatch,
	onClearMatch,
	onIgnore,
	onDelete
}: LibraryFileRowProps) {
	const { t } = useTranslation()

	const form = file.parsed.form
	const number = fileNumber(file)
	const season = fileSeason(file)
	const duration = fileDuration(file)
	const match = file.match

	const playable = Boolean(onPlay) && file.kind === 'video' && !file.missing
	const matchable = Boolean(onMatch) && form !== 'extra'

	const menu: DropdownMenuItem[] = []

	if (matchable) {
		menu.push({
			id: 'match',
			label: match ? t('library.file.change') : t('library.file.match'),
			icon: 'common/link',
			onSelect: () => onMatch?.(file)
		})
	}

	if (onClearMatch && match) {
		menu.push({
			id: 'clear',
			label: t('library.file.clear'),
			icon: 'common/close',
			danger: true,
			onSelect: () => onClearMatch(file)
		})
	}

	if (onIgnore) {
		menu.push({
			id: 'ignore',
			label: file.ignored ? t('library.file.unignore') : t('library.file.ignore'),
			icon: file.ignored ? 'common/eye' : 'common/eye-off',
			onSelect: () => onIgnore(file, !file.ignored)
		})
	}

	if (onDelete) {
		menu.push({
			id: 'delete',
			label: t('library.file.deleteFile'),
			icon: 'common/trash',
			danger: true,
			onSelect: () => onDelete(file)
		})
	}

	const matchHint = match
		? match.source === 'manual'
			? t('library.file.matchedByHand')
			: t('library.file.matched', { percent: Math.round(match.confidence * 100) })
		: t('library.file.unmatched')

	const numbering = [
		season !== null ? t('library.file.season', { number: season }) : null,
		number !== null
			? file.kind === 'video'
				? t('library.file.episode', { number })
				: t('library.file.chapter', { number })
			: null
	].filter(Boolean)

	return (
		<article className={clsx(styles.row, playing && styles.playing)}>
			<span className={styles.marker} aria-hidden>
				<Icon
					name={playing ? 'common/play' : form ? FORM_ICONS[form] : 'common/database'}
					size={playing ? 12 : 14}
				/>
			</span>

			<div className={styles.body}>
				<p className={styles.name} title={file.path}>
					{fileName(file)}
				</p>

				{file.missing && <Badge tone='danger'>{t('library.file.missing')}</Badge>}
				{file.ignored && <Badge>{t('library.file.ignored')}</Badge>}
			</div>

			<span className={styles.number}>{numbering.join(' · ')}</span>

			<span className={styles.duration}>{duration}</span>

			<div className={styles.actions}>
				{playable && (
					<button type='button' className={styles.action} onClick={() => onPlay?.(file)}>
						<Icon name='common/play' size={12} />
						{t('library.file.play')}
					</button>
				)}

				{matchable && (
					<button
						type='button'
						title={matchHint}
						className={styles.action}
						onClick={() => onMatch?.(file)}
					>
						<Icon name='common/link' size={12} />
						{match ? t('library.file.change') : t('library.file.match')}
					</button>
				)}

				{menu.length > 0 && (
					<DropdownMenu
						items={menu}
						trigger={
							<RippleButton className={styles.more} aria-label={t('library.file.menu')}>
								<Icon name='common/more-vertical' size={16} />
							</RippleButton>
						}
					/>
				)}
			</div>
		</article>
	)
}
