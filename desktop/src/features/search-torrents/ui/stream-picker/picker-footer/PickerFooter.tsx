import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import type { TorrentRelease } from '@entities/torrent'

import styles from './PickerFooter.module.scss'

export interface PickerFooterProps {
	selected: TorrentRelease | null
	playable: boolean
	busy: boolean
	preparing: boolean
	onStream: () => void
	className?: string
}

export function PickerFooter({
	selected,
	playable,
	busy,
	preparing,
	onStream,
	className
}: PickerFooterProps) {
	const { t } = useTranslation()

	return (
		<footer className={clsx(styles.footer, className)}>
			{selected && !playable && <span className={styles.hint}>{t('torrents.stream.pickEpisode')}</span>}

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
		</footer>
	)
}
