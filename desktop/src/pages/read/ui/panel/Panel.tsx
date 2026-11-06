import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, WindowControls } from '@shared/ui'

import { useBookEntrance } from '@entities/reader'

import styles from './Panel.module.scss'

export interface PanelProps {
	onClose: () => void
	children: ReactNode
	openedAt?: number
}

export function Panel({ onClose, children, openedAt }: PanelProps) {
	const { t } = useTranslation()
	const [fallbackOpenedAt] = useState(() => performance.now())
	const entrance = useBookEntrance(openedAt ?? fallbackOpenedAt)
	const entering = openedAt != null && entrance.entering

	return (
		<div
			className={clsx(styles.root, entering && styles.enter)}
			style={entering ? entrance.style : undefined}
		>
			<header className={styles.top}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>
				<WindowControls className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
