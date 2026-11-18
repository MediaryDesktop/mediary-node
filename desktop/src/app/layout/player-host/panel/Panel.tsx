import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { useAfterDelay } from '@shared/lib'
import { Button, Icon, WindowControls } from '@shared/ui'

import { useWindowControls } from '@infra/window'

import { usePlayerEntrance } from '@entities/playback'

import styles from '../PlayerHost.module.scss'

const LEAVE_MS = 240

export interface PanelProps {
	onClose: () => void
	leaving?: boolean
	onLeft?: () => void
	children: ReactNode
}

export function Panel({ onClose, leaving, onLeft, children }: PanelProps) {
	const windowControls = useWindowControls()

	const { t } = useTranslation()

	const entrance = usePlayerEntrance()

	useAfterDelay(Boolean(leaving), LEAVE_MS, () => onLeft?.())

	return (
		<div
			className={clsx(styles.root, entrance.entering && styles.enter, leaving && styles.leave)}
			style={entrance.entering && !leaving ? entrance.style : undefined}
		>
			<header className={styles.top}>
				<Button
					variant='chrome'
					iconOnly
					aria-label={t('playback.stop')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>
				<WindowControls {...windowControls} className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
