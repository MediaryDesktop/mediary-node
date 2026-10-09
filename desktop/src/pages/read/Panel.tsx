import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, WindowControls } from '@shared/ui'

import styles from './ReadPage.module.scss'

// What a reader shows while there is nothing to read yet: the way back, and why.
export function Panel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
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
