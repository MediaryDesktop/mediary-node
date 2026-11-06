import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'

import { formatTimecode } from '../../../model/model'
import type { VideoActions } from '../lib/useVideoActions'

import { ControlButton } from './control-button/ControlButton'
import styles from './PlayerControls.module.scss'

export interface PlayerControlsProps {
	visible: boolean
	playing: boolean
	position: number
	duration: number
	volume: number
	muted: boolean
	fullscreen: boolean
	actions: VideoActions
	onToggleFullscreen: () => void
	onClose: () => void
	children?: ReactNode
}

function percent(part: number, whole: number): string {
	return whole ? `${(part / whole) * 100}%` : '0%'
}

export function PlayerControls({
	visible,
	playing,
	position,
	duration,
	volume,
	muted,
	fullscreen,
	actions,
	onToggleFullscreen,
	onClose,
	children
}: PlayerControlsProps) {
	const { t } = useTranslation()
	const shownVolume = muted ? 0 : volume

	return (
		<footer className={clsx(styles.bottom, visible && styles.visible)}>
			<input
				type='range'
				className={styles.seek}
				min={0}
				max={duration || 0}
				step={0.1}
				value={position}
				aria-label={t('player.seek')}
				style={{ '--progress': percent(position, duration) } as CSSProperties}
				onChange={event => actions.seekTo(Number(event.target.value))}
			/>

			<div className={styles.bar}>
				<ControlButton
					icon={playing ? 'common/pause' : 'common/play'}
					label={playing ? t('player.pause') : t('player.play')}
					onClick={actions.togglePlay}
				/>

				<ControlButton
					icon={muted || volume === 0 ? 'common/volume-off' : 'common/volume'}
					label={muted ? t('player.unmute') : t('player.mute')}
					onClick={actions.toggleMute}
				/>

				<input
					type='range'
					className={styles.volume}
					min={0}
					max={1}
					step={0.01}
					value={shownVolume}
					aria-label={t('player.volume')}
					style={{ '--progress': percent(shownVolume, 1) } as CSSProperties}
					onChange={event => actions.changeVolume(Number(event.target.value))}
				/>

				<span className={styles.time}>
					{formatTimecode(position)} / {formatTimecode(duration)}
				</span>

				<span className={styles.spacer} />

				{children}

				<ControlButton
					icon={fullscreen ? 'common/fullscreen-exit' : 'common/fullscreen'}
					label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
					onClick={onToggleFullscreen}
				/>

				<ControlButton icon='common/close' label={t('playback.stop')} onClick={onClose} closing />
			</div>
		</footer>
	)
}
