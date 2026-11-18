import * as Menu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { PointerEvent, Ref } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { episodeTitle } from '@entities/media'

import type { PlayEntry } from '../../../lib/play-list'
import styles from '../PlayMenu.module.scss'

export interface EpisodeItemProps {
	ref?: Ref<HTMLDivElement>
	entry: PlayEntry
	isNext: boolean
	onPlay: (entry: PlayEntry) => void
	onDownload?: (entry: PlayEntry) => void
}

const keepFromItem = (event: PointerEvent) => event.stopPropagation()

export function EpisodeItem({ ref, entry, isNext, onPlay, onDownload }: EpisodeItemProps) {
	const { t, i18n } = useTranslation()

	const title =
		(entry.episode ? episodeTitle(entry.episode, i18n.language) : null) ??
		t('media.card.menu.episode', { number: entry.number })

	return (
		<Menu.Item
			ref={ref}
			className={clsx(styles.item, styles.episode, isNext && styles.next, !entry.file && styles.absent)}
			onSelect={() => onPlay(entry)}
		>
			<span className={styles.number}>{entry.number}</span>
			<span className={styles.text}>{title}</span>

			{isNext && <span className={styles.tag}>{t('media.card.menu.next')}</span>}

			{entry.watched ? (
				<Icon name='common/check' size={14} className={styles.aside} />
			) : !entry.file && onDownload ? (
				<button
					type='button'
					tabIndex={-1}
					className={styles.download}
					aria-label={t('media.card.menu.download', { label: title })}
					title={t('media.card.menu.download', { label: title })}
					onPointerDown={keepFromItem}
					onPointerUp={keepFromItem}
					onClick={event => {
						event.preventDefault()
						event.stopPropagation()
						onDownload(entry)
					}}
				>
					<Icon name='common/download' size={14} />
				</button>
			) : entry.episode?.runtime_minutes ? (
				<span className={styles.aside}>
					{t('media.library.minutes', { count: entry.episode.runtime_minutes })}
				</span>
			) : null}
		</Menu.Item>
	)
}
