import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon } from '@shared/ui'

import type { TorrentRelease } from '@entities/torrent'

import { releaseLabel } from '../../../lib/releases'

import styles from './PickerFooter.module.scss'

export interface PickerFooterProps {
	selected: TorrentRelease | null
	playable: boolean
	busy: boolean
	preparing: boolean
	onCancel: () => void
	onStream: () => void
	className?: string
}

export function PickerFooter({
	selected,
	playable,
	busy,
	preparing,
	onCancel,
	onStream,
	className
}: PickerFooterProps) {
	const { t } = useTranslation()

	return (
		<footer className={clsx(styles.footer, className)}>
			<div className={styles.selection}>
				<span className={styles.caption}>{t('torrents.search.picker.selected')}</span>
				<span className={styles.value}>
					{selected
						? [releaseLabel(selected, t), selected.size > 0 ? formatBytes(selected.size) : null]
								.filter(Boolean)
								.join(' · ')
						: t('torrents.search.picker.pick')}
				</span>
				{selected && !playable && (
					<span className={styles.hint}>{t('torrents.stream.pickEpisode')}</span>
				)}
			</div>

			<div className={styles.actions}>
				<Button variant='secondary' onClick={onCancel}>
					{t('torrents.search.picker.cancel')}
				</Button>
				<Button
					variant='primary'
					className={styles.stream}
					startIcon={<Icon name='common/play' size={16} />}
					disabled={!selected || !playable || busy}
					loading={preparing}
					onClick={onStream}
				>
					{t('torrents.search.picker.stream')}
				</Button>
			</div>
		</footer>
	)
}
