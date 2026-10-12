import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, WindowControls } from '@shared/ui'

import styles from './PlayerHeader.module.scss'

export interface PlayerHeaderProps {
	mini: boolean
	visible: boolean
	fullscreen: boolean
	heading: string
	subheading?: string
	onMinimize: () => void
	onExpand: () => void
	onClose: () => void
}

// Full: back to the page, what is playing, the window buttons. Mini: expand and stop.
export function PlayerHeader({
	mini,
	visible,
	fullscreen,
	heading,
	subheading,
	onMinimize,
	onExpand,
	onClose
}: PlayerHeaderProps) {
	const { t } = useTranslation()

	if (mini) {
		return (
			<header className={clsx(styles.top, styles.mini, visible && styles.visible)}>
				<Button
					variant='chrome'
					iconOnly
					aria-label={t('player.expand')}
					startIcon={<Icon name='common/maximize' size={18} />}
					onClick={onExpand}
				/>

				<Button
					variant='chrome-close'
					iconOnly
					className={styles.controlEnd}
					aria-label={t('playback.stop')}
					startIcon={<Icon name='common/close' size={16} />}
					onClick={onClose}
				/>
			</header>
		)
	}

	return (
		<header className={clsx(styles.top, visible && styles.visible)}>
			<Button
				variant='chrome'
				iconOnly
				aria-label={t('player.minimize')}
				startIcon={<Icon name='common/arrow-left' size={22} />}
				onClick={onMinimize}
			/>

			<div className={styles.heading}>
				<span className={styles.title}>{heading}</span>
				{subheading && <span className={styles.subtitle}>{subheading}</span>}
			</div>

			{!fullscreen && <WindowControls className={styles.window} />}
		</header>
	)
}
