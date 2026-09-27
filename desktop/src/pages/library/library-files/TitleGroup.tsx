import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { LibraryFileRow } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import type { FileGroup } from '../lib/library-view'

import styles from './TitleGroup.module.scss'

// How many episodes a card shows before it offers the rest. A show with a
// thousand files would otherwise make the page unusable the moment it loads.
const PREVIEW_ROWS = 3

export interface TitleGroupProps {
	group: FileGroup
	compact?: boolean
	playingFileID?: number
	onPlay: (file: LibraryFile) => void
	onMatch: (file: LibraryFile) => void
	onClearMatch: (file: LibraryFile) => void
}

export function TitleGroup({
	group,
	compact,
	playingFileID,
	onPlay,
	onMatch,
	onClearMatch
}: TitleGroupProps) {
	const { t } = useTranslation()

	const [open, setOpen] = useState(true)
	const [expanded, setExpanded] = useState(false)

	const cover = group.title_info?.cover_image
	const color = group.title_info?.cover_color

	const shown = expanded ? group.files : group.files.slice(0, PREVIEW_ROWS)
	const rest = group.files.length - shown.length

	const [firstSeason] = group.seasons

	// One season is named, several are counted: "Season 2" is what the files
	// actually say, while "1 season" reads as season one and tells nobody which.
	const seasons =
		group.seasons.length > 1
			? t('library.group.seasons', { count: group.seasons.length })
			: firstSeason !== undefined
				? t('library.group.season', { number: firstSeason })
				: null

	const meta = [seasons, t('library.group.episodes', { count: group.files.length })].filter(Boolean)

	return (
		<article className={clsx(styles.group, compact && styles.compact)}>
			{!compact && (
				<span className={styles.poster} style={{ background: color ?? undefined }}>
					{cover ? (
						<img src={cover} alt='' loading='lazy' />
					) : (
						<Icon name='common/database' size={20} />
					)}
				</span>
			)}

			<div className={styles.content}>
				<header className={styles.header}>
					<div className={styles.heading}>
						<h3 className={styles.title}>{group.title}</h3>

						<p className={styles.meta}>{meta.join(' · ')}</p>
					</div>

					<span className={clsx(styles.status, group.matched ? styles.done : styles.pending)}>
						<Icon name={group.matched ? 'common/check' : 'common/info'} size={12} />
						{group.matched ? t('library.group.matched') : t('library.group.unmatched')}
					</span>

					<button
						type='button'
						className={styles.toggle}
						aria-expanded={open}
						aria-label={open ? t('library.group.collapse') : t('library.group.expand')}
						onClick={() => setOpen(current => !current)}
					>
						<Icon
							name='common/chevron-down'
							size={18}
							className={clsx(styles.chevron, open && styles.up)}
						/>
					</button>
				</header>

				{open && (
					<div className={styles.rows}>
						{shown.map(file => (
							<LibraryFileRow
								key={file.id}
								file={file}
								playing={file.id === playingFileID}
								onPlay={onPlay}
								onMatch={onMatch}
								onClearMatch={onClearMatch}
							/>
						))}

						{(rest > 0 || expanded) && (
							<button
								type='button'
								className={styles.more}
								onClick={() => setExpanded(current => !current)}
							>
								<Icon name={expanded ? 'common/close' : 'common/plus'} size={14} />
								{expanded
									? t('library.group.less')
									: t('library.group.more', { count: rest })}
							</button>
						)}
					</div>
				)}
			</div>
		</article>
	)
}
