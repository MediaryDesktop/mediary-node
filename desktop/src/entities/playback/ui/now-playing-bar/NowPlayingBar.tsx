import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon, ProgressBar, Tooltip } from '@shared/ui'

import { formatTimecode, playbackModel } from '../model/model'

import styles from './NowPlayingBar.module.scss'

export function NowPlayingBar() {
	const { t } = useTranslation()

	const [session, command, stop] = useUnit([
		playbackModel.$session,
		playbackModel.commandRequested,
		playbackModel.stopRequested
	])

	if (!session) {
		return null
	}

	return (
		<aside className={styles.bar}>
			<div className={styles.body}>
				<p className={styles.title}>
					{session.title}
					{session.episode !== undefined && (
						<span className={styles.episode}>
							{t('playback.episode', { number: session.episode })}
						</span>
					)}
					{session.watched && <Badge tone='success'>{t('playback.watched')}</Badge>}
				</p>

				<div className={styles.timeline}>
					<span className={styles.time}>{formatTimecode(session.position)}</span>
					<ProgressBar
						value={session.position}
						max={session.duration}
						className={styles.progress}
					/>
					<span className={styles.time}>{formatTimecode(session.duration)}</span>
				</div>
			</div>

			<div className={styles.controls}>
				<Tooltip content={session.paused ? t('playback.resume') : t('playback.pause')}>
					<button
						type='button'
						className={styles.control}
						aria-label={session.paused ? t('playback.resume') : t('playback.pause')}
						onClick={() => command({ action: session.paused ? 'resume' : 'pause' })}
					>
						<Icon name={session.paused ? 'common/play' : 'common/minimize'} size={16} />
					</button>
				</Tooltip>

				<Tooltip content={t('playback.stop')}>
					<button
						type='button'
						className={styles.control}
						aria-label={t('playback.stop')}
						onClick={() => stop()}
					>
						<Icon name='common/close' size={16} />
					</button>
				</Tooltip>
			</div>
		</aside>
	)
}
